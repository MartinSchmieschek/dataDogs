/**
 * UI-Komponente für KennelConfig-Verwaltung
 * Ermöglicht das Bearbeiten, Speichern und Laden von KennelConfigs
 * sowie das Hinzufügen von SerializedDogs zur Config
 */
export function buildKennelConfigEditor(): string {
  return `
<div id="kennel-config-editor" style="display: none; padding: 20px; background: #1a1a1a; color: #fff; border: 1px solid #333; margin: 20px 0;">
  <h2 style="margin-top: 0;">Kennel Config Editor</h2>
  
  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 5px;"><strong>Kennel ID:</strong></label>
    <input type="text" id="kennel-config-id" value="default-kennel" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333;">
    <button id="kennel-config-load" style="margin-top: 10px; padding: 8px 16px; background: #0066cc; color: #fff; border: none; cursor: pointer;">Laden</button>
  </div>

  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 5px;"><strong>Name:</strong></label>
    <input type="text" id="kennel-config-name" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333;">
  </div>

  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 5px;"><strong>Description:</strong></label>
    <textarea id="kennel-config-description" rows="3" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333; resize: vertical;"></textarea>
  </div>

  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 5px;"><strong>Base Dog Types:</strong></label>
    <div id="kennel-config-base-dog-types" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" value="RandomRecipesRetriever" class="base-dog-type">
        <span>RandomRecipesRetriever</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" value="CountryFlagBlackLab" class="base-dog-type">
        <span>CountryFlagBlackLab</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" value="DishFlagBlackLab" class="base-dog-type">
        <span>DishFlagBlackLab</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" value="RandomEveryThingRetriever" class="base-dog-type">
        <span>RandomEveryThingRetriever</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" value="TalkingDog" class="base-dog-type">
        <span>TalkingDog</span>
      </label>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 5px;"><strong>SerializedDogs (dogIds):</strong></label>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px;">Verfügbare SerializedDogs:</label>
        <div id="kennel-config-available-dogs" style="max-height: 300px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #000;">
          <div style="color: #666; text-align: center; padding: 20px;">Lade SerializedDogs...</div>
        </div>
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Ausgewählte Hunde (Reihenfolge = Ausführungsreihenfolge):</label>
        <p style="color: #999; font-size: 11px; margin-bottom: 5px;">Der erste Hund in der Liste liefert die Ergebnisse über /:kennelId</p>
        <div id="kennel-config-selected-dogs" style="max-height: 300px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #000;">
          <div style="color: #666; text-align: center; padding: 20px;">Keine ausgewählt</div>
        </div>
      </div>
    </div>
  </div>

  <div style="display: flex; gap: 10px; margin-top: 20px;">
    <button id="kennel-config-save" style="padding: 10px 20px; background: #00cc00; color: #fff; border: none; cursor: pointer; font-weight: bold;">Speichern</button>
    <button id="kennel-config-close" style="padding: 10px 20px; background: #666; color: #fff; border: none; cursor: pointer;">Schließen</button>
  </div>
</div>
`;
}

