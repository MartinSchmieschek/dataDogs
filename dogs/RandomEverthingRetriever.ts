import { AbstractHuntingDog } from "../enities/abstractHuntingDog";
import { IHuntingSeason } from "../enities/IHuntingSeason";
import { InterfaceSniper } from "../InterfaceSniper";
import { IJustAll } from "./interfaceDump/IJustAll.interface";



export class RandomEveryThingRetriever extends AbstractHuntingDog<IJustAll> {

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<any> = (season: IHuntingSeason) => {
        return this.request(season)
    }

    @InterfaceSniper("IJustAll", "../dogs/interfaceDump/IJustAll.interface.ts")
    public async request(season: IHuntingSeason): Promise<any> {

        let all: any = {};
        let apis: Map<string, { url: string }> = new Map();
        apis.set("characters", {
            url: "https://anapioficeandfire.com/api/characters/" + Math.floor(Math.random() * 501)
        })
        apis.set("woof", {
            url: "https://random.dog/woof.json"
        })

        for await (const api of apis) {
            try {
                const reciepResponse = await fetch(api[1].url);
                const json = await reciepResponse.json()
                all[api[0]] = json

            } catch (e) {
                console.warn(e)
                //throw e
            }
        }

        return all;
    }

    get name() {
        return RandomEveryThingRetriever.name
    }

    isReady(collection: IHuntingSeason): boolean {
        // A Retriever is always ready
        return true;
    }


}