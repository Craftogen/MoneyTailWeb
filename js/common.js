const UNIFIED_ID_SEP = "_";

export function ununify_id(id) {
    return id.split(UNIFIED_ID_SEP);
}

export function section_id_from_transaction_id(id) {
    let ids = id.split(UNIFIED_ID_SEP);
    // <workbook>_<worksheet>_<section>
    return `${ids[0]}${UNIFIED_ID_SEP}${ids[1]}${UNIFIED_ID_SEP}${ids[2]}`;
}

export function worksheet_id_from_transaction_id(id) {
    let ids = id.split(UNIFIED_ID_SEP);
    // <workbook>_<worksheet>
    return `${ids[0]}${UNIFIED_ID_SEP}${ids[1]}`;
}

export function textToArrayBuffer(text) {
    const encoder = new TextEncoder();
    return encoder.encode(text).buffer;
}