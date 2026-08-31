import { autoMapColumns } from "../src/components/ColumnMapper";
import { PRODUCT_FIELDS } from "../src/lib/productConverter";

const headers = ["Descrisão", "Ref. Final", "Ref. Base", "Tecido", "Cod. Molde", "OBS.", "Grade"];
console.log(JSON.stringify(autoMapColumns(headers, PRODUCT_FIELDS), null, 2));
