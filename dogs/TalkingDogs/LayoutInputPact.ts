import { createPact } from "datadogs";
import { ILayoutInput } from "./renderer/layouts/ILayoutInput";

export const LayoutInputPact = createPact<ILayoutInput>('LayoutInputProvider');
