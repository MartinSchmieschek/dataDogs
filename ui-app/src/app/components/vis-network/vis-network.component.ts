import {
  Component, Input, Output, EventEmitter,
  ElementRef, ViewChild, OnChanges, OnDestroy, SimpleChanges
} from '@angular/core';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { Network, DataSet } from 'vis-network/standalone';

@Component({
  selector: 'app-vis-network',
  standalone: true,
  template: `<div #networkContainer class="network-container"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .network-container { width: 100%; height: 100%; background: #0a0a0a; }
  `]
})
export class VisNetworkComponent implements OnChanges, OnDestroy {
  @ViewChild('networkContainer', { static: true }) containerRef!: ElementRef;

  @Input() waves: Waves = [];
  @Output() dogSelected = new EventEmitter<DogEntry>();
  @Output() dogDeleted = new EventEmitter<string>();

  private network: Network | null = null;
  private dogMap = new Map<string, DogEntry>();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['waves']) {
      this.renderNetwork();
    }
  }

  ngOnDestroy() {
    this.network?.destroy();
  }

  private renderNetwork() {
    this.dogMap.clear();

    const nodes: any[] = [];
    const edges: any[] = [];

    this.waves.forEach((wave, waveIndex) => {
      wave.forEach(dog => {
        this.dogMap.set(dog.id, dog);

        const hasError = !!dog.error;
        const isSerializedDog = !!dog.codeTs;

        nodes.push({
          id: dog.id,
          label: dog.name,
          level: waveIndex,
          color: {
            background: hasError ? '#cc0000' : (isSerializedDog ? '#1a3a5c' : '#2a2a2a'),
            border: hasError ? '#ff0000' : (isSerializedDog ? '#0066cc' : '#555'),
            highlight: { background: '#003366', border: '#0099ff' },
          },
          font: { color: '#fff', size: 14 },
          shape: 'box',
          margin: 10,
        });

        (dog.parentsRequired ?? []).forEach(parentId => {
          const cleanId = parentId.startsWith('base:') ? parentId.substring(5) : parentId;
          edges.push({
            from: cleanId,
            to: dog.id,
            color: { color: '#cc0000', highlight: '#ff0000' },
            arrows: 'to',
            dashes: false,
            width: 2,
          });
        });

        (dog.parentsOptional ?? []).forEach(parentId => {
          const cleanId = parentId.startsWith('base:') ? parentId.substring(5) : parentId;
          edges.push({
            from: cleanId,
            to: dog.id,
            color: { color: '#0066cc', highlight: '#0099ff' },
            arrows: 'to',
            dashes: true,
            width: 1,
          });
        });
      });
    });

    const nodesDataSet = new DataSet(nodes);
    const edgesDataSet = new DataSet(edges);

    if (this.network) {
      this.network.setData({ nodes: nodesDataSet, edges: edgesDataSet });
    } else {
      this.network = new Network(
        this.containerRef.nativeElement,
        { nodes: nodesDataSet, edges: edgesDataSet },
        {
          layout: {
            hierarchical: {
              enabled: true,
              direction: 'LR',
              sortMethod: 'directed',
              levelSeparation: 200,
              nodeSpacing: 100,
            },
          },
          physics: { enabled: false },
          interaction: {
            hover: true,
            selectConnectedEdges: true,
          },
        }
      );

      this.network.on('click', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const dog = this.dogMap.get(nodeId);
          if (dog) {
            this.dogSelected.emit(dog);
          }
        }
      });
    }
  }
}
