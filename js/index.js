/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as constants from "./constants.js";
import Tabs from "./tabs.js";
import AppStorage from "./app_storage.js";
import * as app_storage from "./app_storage.js";
import { SortType, SortBy } from "../wasm/main.js";
import * as common from "./common.js";

let mainWorker = null;

let prefs = {};
prefs[constants.PREF_SECTIONS.WORKBOOKS] = {}
prefs[constants.PREF_SECTIONS.WORKBOOKS][constants.PREF_PROPERTY.SORT_BY] = SortBy.Name;
prefs[constants.PREF_SECTIONS.WORKBOOKS][constants.PREF_PROPERTY.SORT_TYPE] = SortType.Ascending;
prefs[constants.PREF_SECTIONS.WORKSHEETS] = {}
prefs[constants.PREF_SECTIONS.WORKSHEETS][constants.PREF_PROPERTY.SORT_BY] = SortBy.Name;
prefs[constants.PREF_SECTIONS.WORKSHEETS][constants.PREF_PROPERTY.SORT_TYPE] = SortType.Ascending;
prefs[constants.PREF_SECTIONS.ACCOUNTS] = {}
prefs[constants.PREF_SECTIONS.ACCOUNTS][constants.PREF_PROPERTY.SORT_BY] = SortBy.Name;
prefs[constants.PREF_SECTIONS.ACCOUNTS][constants.PREF_PROPERTY.SORT_TYPE] = SortType.Ascending;
prefs[constants.PREF_SECTIONS.WS_TXNS] = {}
prefs[constants.PREF_SECTIONS.WS_TXNS][constants.PREF_PROPERTY.SORT_BY] = SortBy.Date;
prefs[constants.PREF_SECTIONS.WS_TXNS][constants.PREF_PROPERTY.SORT_TYPE] = SortType.Ascending;
prefs[constants.PREF_SECTIONS.SETTLE_REPORT] = {};
prefs[constants.PREF_SECTIONS.SETTLE_REPORT][constants.PREF_PROPERTY.EXCLUDE_LIST] = [];
prefs[constants.PREF_SECTIONS.AC_TXN_REPORT] = {};
prefs[constants.PREF_SECTIONS.AC_TXN_REPORT][constants.PREF_PROPERTY.EXCLUDE_LIST] = [];

const UI_SECTION = {
    WORKBOOKS: 101,
    ACCOUNTS: 102,
    REPORTS: 103,
    TRANSACTIONS: 104,
    GLOBAL: 105
}

const UI_SECTION_PROPERTY = {
    // Since txn id can be used in place of ws & wb id and
    // ws id can be used in place of wb id, we can use one
    // UNFIED_ID for all types of ids.
    UNIFIED_ID: 201,
    NAME: 202,
    ACTION: 203,
    TYPE: 204,
    DIRTY: 205,
    PASTE: 206,
    LAST_SELECTED: 207
}

const ENTRY_FLAG = {
    NONE: 0,
    WORKBOOKS: 1,
    WORKSHEETS: 2,
    SECTIONS: 4,
    TRANSACTIONS: 8,
    ACCOUNTS: 16 
}

let state = {};
state[UI_SECTION.WORKBOOKS] = {};
state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] = null;
state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME] = null;
state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] = null;
state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.DIRTY] = ENTRY_FLAG.NONE;
state[UI_SECTION.ACCOUNTS] = {};
state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID] = null;
state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.NAME] = null;
state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.ACTION] = null;
state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.DIRTY] = ENTRY_FLAG.NONE;
state[UI_SECTION.REPORTS] = {};
state[UI_SECTION.REPORTS][UI_SECTION_PROPERTY.TYPE] = null;
state[UI_SECTION.TRANSACTIONS] = {};
state[UI_SECTION.TRANSACTIONS][UI_SECTION_PROPERTY.LAST_SELECTED] = null;
state[UI_SECTION.GLOBAL] = {};
state[UI_SECTION.GLOBAL][UI_SECTION_PROPERTY.PASTE] = null;

function setFlag(state, flag) {
    state |= flag;
    return state;
}

function clearFlag(state, flag) {
    state &= ~flag;
    return state;
}

function testFlag(state, flag) {
    return (state & flag) > 0;
}

function setWorkbooksFlags(flags) {
    Array.from(flags).forEach((f) => {
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.DIRTY] =
            setFlag(state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.DIRTY], f);
    })
}

function clearWorkbooksFlags(flags) {
    Array.from(flags).forEach((f) => {
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.DIRTY] =
            clearFlag(state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.DIRTY], f);
    })
}

function testWorkbooksFlag(flag) {
    return testFlag(state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.DIRTY], flag);
}

function setAccountsFlags(flags) {
    Array.from(flags).forEach((f) => {
        state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.DIRTY] =
            setFlag(state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.DIRTY], f);
    })
}

function clearAccountsFlags(flags) {
    Array.from(flags).forEach((f) => {
        state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.DIRTY] =
            clearFlag(state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.DIRTY], f);
    })
}

function testAccountsFlag(flag) {
    return testFlag(state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.DIRTY], flag);
}

function setPaste(entryType, isCut, unifiedId) {
    state[UI_SECTION.GLOBAL][UI_SECTION_PROPERTY.PASTE] = [entryType, isCut, unifiedId];
}

function getPaste() {
    return state[UI_SECTION.GLOBAL][UI_SECTION_PROPERTY.PASTE];
}

function clearPaste() {
    state[UI_SECTION.GLOBAL][UI_SECTION_PROPERTY.PASTE] = null;
}

function testPaste(entryFlags) {
    let paste = state[UI_SECTION.GLOBAL][UI_SECTION_PROPERTY.PASTE]
    if (paste == null) {
        return false;
    }

    if (testFlag(entryFlags, paste[0])) {
        return true;
    }

    return false;
}

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.addEventListener("pause", onPause, false);
}

function de(id) {
    return document.getElementById(id);
}

function select_file(contentType){
    return new Promise(resolve => {
        let input = document.createElement('input');
        input.type = 'file';
        input.accept = contentType;

        input.onchange = () => {
            let files = Array.from(input.files);
            resolve(files[0]);
        };

        input.click();
    });
}

function read_file_content(file) {
    return new Promise(resolve => {
        let reader = new FileReader();

        reader.onload = readerEvent => {
            let content = readerEvent.target.result;
            resolve(content);
        };

        reader.readAsArrayBuffer(file);
    });
}

function saveFile(content, fileName, dirName) {
    if (content && content != "") {
        new AppStorage(app_storage.SOME_ID, fileName, dirName)
            .writeText(content)
            .catch((err) => {
                navigator.notification.alert(
                    `Unexpected error saving file - ${err.message}`,
                    undefined, "Error");
            });
    }
}

function select_save_file(appStorageType, content, successMsg, failMsg) {
    new AppStorage(appStorageType)
        .writeTextSelect(content)
        .then((uri) => {
            if (typeof uri == "string") {
                navigator.notification.alert(
                    `${successMsg} - '${uri}'`, undefined, "Information");
            } else {
                navigator.notification.alert(
                    `${successMsg}`, undefined, "Information");
            }
        })
        .catch((err) => {
            if (err?.message) {
                navigator.notification.alert(
                    `${failMsg} - ${err.message}`, undefined, "Error");
            } else if (typeof err == "string") {
                navigator.notification.alert(
                    `${failMsg} - ${err}`, undefined, "Error");
            }
        })
}

function make_active(active_id, inactive_id) {
    if (active_id) {
        de(active_id).classList.remove("inactive");
    }

    if (inactive_id) {
        de(inactive_id).classList.add("inactive");
    }
}

function select_clear(select_id) {
    let elem = de(select_id);
    while (elem.options.length) {
        elem.remove(0);
    }
}

function select_add_option(select_id, option_id, option_text) {
    let o = document.createElement("option");
    o.id = option_id;
    o.text = option_text;
    de(select_id).add(o);
}

let amt_formatter =
    Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
        });

function fmt_amt(amt) {
    return amt_formatter.formatToParts(amt).map(
        p => p.type != "literal" && p.type != "currency" ? p.value : ''
    ).join("");
}

function update_sort_icon() {
    let elems = document.getElementsByClassName("sort");
    Array.from(elems).forEach((e) => {
        e.innerHTML = "";
    });

    elems = document.getElementsByClassName("sort_asc");
    Array.from(elems).forEach((e) => {
        e.innerHTML =
            `<svg width="48" height="48" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m6.35 3.7042 5.2917 5.2917"/>` +
            `<path d="m6.35 3.7042-5.2917 5.2917"/>` +
            `</svg>`;
    });

    elems = document.getElementsByClassName("sort_dsc");
    Array.from(elems).forEach((e) => {
        e.innerHTML =
            `<svg width="48" height="48" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m6.35 8.9958-5.2917-5.2917"/>` +
            `<path d="m6.35 8.9958 5.2917-5.2917"/>` +
            `</svg>`;
    });
}

function remove_descendants_classes(parent_elem, class_names) {
    parent_elem.childNodes.forEach((e) => {
        if (e.classList) {
            class_names.forEach((c) => {
                e.classList.remove(c);
            });
        }

        remove_descendants_classes(e, class_names);
    });
}

function toggle_sort_type(sort_type, elem) {
    if (sort_type == SortType.Ascending) {
        elem.classList.add("sort_dsc")
        elem.classList.remove("sort_asc")
        return SortType.Descending;
    } else {
        elem.classList.remove("sort_dsc")
        elem.classList.add("sort_asc")
        return SortType.Ascending;
    }
}

function update_sort_ui(sort_prefs, sort_by, sort_icon_elem, head_elem) {
    if (sort_prefs[constants.PREF_PROPERTY.SORT_BY] != sort_by) {
        sort_prefs[constants.PREF_PROPERTY.SORT_TYPE] = SortType.Unsorted;
        remove_descendants_classes(head_elem, ["sort_asc", "sort_dsc"]);
    }
    sort_prefs[constants.PREF_PROPERTY.SORT_BY] = sort_by;
    sort_prefs[constants.PREF_PROPERTY.SORT_TYPE] = toggle_sort_type(
        sort_prefs[constants.PREF_PROPERTY.SORT_TYPE],
        sort_icon_elem);

    update_sort_icon();
}

function load_prefs() {
    new AppStorage(app_storage.SOME_ID, constants.PREFS_DATA, constants.CURRENT_DIR)
        .readText()
        .then((content) => {
            prefs = JSON.parse(content);
        })
        .catch((err) => {
            console.log(`Unable to load prefs - ${errMsg(err)}`);
        })
}

function save_prefs() {
    saveFile(JSON.stringify(prefs), constants.PREFS_DATA, constants.CURRENT_DIR);
}

function load_accounts() {
    new AppStorage(app_storage.SOME_ID, constants.ACCOUNTS_DATA, constants.CURRENT_DIR)
        .readAsArrayBuffer()
        .then((content) => {
            mainWorker.postMessage(
                [constants.MSG_LOAD, content], [content]);
            mainWorker.postMessage([constants.MSG_ACCOUNTS, prefs]);
        })
        .catch((err) => {
            navigator.notification.alert(
                `Unexpected error loading accounts - "${err.message}"`,
                undefined, "Error");
        })
}

function load_worksheets(wb_data) {
    const wb_obj = JSON.parse(wb_data);
    let readFilePromises = [];
    let doneCount = 0;
    for (let i = 0; i < wb_obj.length; i++) {
        let wb_id = wb_obj[i][0];
        new AppStorage(app_storage.APP_EXT, null, wb_id)
            .listFiles(
                (file) => {
                    // This fn is called multiple times
                    let p = read_file_content(file)
                    readFilePromises.push(p);

                    p.then((content) => {
                        mainWorker.postMessage(
                            [constants.MSG_LOAD, content], [content]);
                    });
                },
                () => {
                    // doneCallback
                    doneCount++;
                    if (doneCount == wb_obj.length) {
                        Promise
                            .all(readFilePromises)
                            .then(() => {
                                mainWorker.postMessage([constants.MSG_WORKBOOKS, prefs]);
                                load_accounts();
                            });
                    }
                });
    }
}

function load_workbooks() {
    new AppStorage(app_storage.SOME_ID, constants.WORKBOOKS_DATA, constants.CURRENT_DIR)
        .readAsArrayBuffer()
        .then((content) => {
            mainWorker.postMessage(
                [constants.MSG_LOAD_WORKBOOKS, content], [content]);
        })
        .catch((err) => {
            if (err instanceof FileError && err.code == FileError.NOT_FOUND_ERR) {
                mainWorker.postMessage([constants.MSG_SAVE_DEFAULT, prefs]);
            } else {
                navigator.notification.alert(
                    `Unexpected error loading workbooks - "${err.message}"`,
                    undefined, "Error");
            }
        })
}

function onBeforeShowAccountsPanel(event) {
    if (testAccountsFlag(ENTRY_FLAG.ACCOUNTS)) {
        mainWorker.postMessage([constants.MSG_ACCOUNTS, prefs]);
        clearAccountsFlags([ENTRY_FLAG.ACCOUNTS]);
    }
}

function populate_exclude_wbs(multi_sel_obj, id_prefix, wbs_json, exclude_wbs_ids) {
    let wbs_obj = JSON.parse(wbs_json);

    let html = "";
    for (let i = 0; i < wbs_obj.length; i++) {
        let id = wbs_obj[i][0];
        html += `<div class="multi_select_item"><input type="checkbox" id="${id_prefix}${id}" `;
        if (exclude_wbs_ids.includes(id)) {
            html += `checked="checked"`;
        }

        html += `/>${wbs_obj[i][1]}</div><br/>`;
    }

    multi_sel_obj.innerHTML = html;
}

function get_exclude_wbs_list(multi_sel_obj, id_prefix) {
    let exclude_wbs = []
    multi_sel_obj.childNodes.forEach((e) => {
        if (e instanceof HTMLDivElement) {
            e.childNodes.forEach((e) => {
                if (e instanceof HTMLInputElement && e.checked) {
                    exclude_wbs.push(e.id.slice(id_prefix.length));
                }
            })
        }
    })

    return exclude_wbs;
}

function enableContextMenuItem(item, enable) {
    if (enable) {
        item.classList.remove("disabled");
    } else {
        item.classList.add("disabled");
    }
}

function pasteIf(allowedFlags) {
    let [entryType, isCut, fromUnifiedId] = getPaste();

    let msgId = constants.MSG_INVALID;
    if (entryType == ENTRY_FLAG.WORKSHEETS &&
            testFlag(allowedFlags, ENTRY_FLAG.WORKSHEETS)) {
        msgId = isCut
            ? constants.MSG_MOVE_WORKSHEET
            : constants.MSG_COPY_WORKSHEET;
    } else if (entryType == ENTRY_FLAG.SECTIONS &&
            testFlag(allowedFlags, ENTRY_FLAG.SECTIONS)) {
        msgId = isCut
            ? constants.MSG_MOVE_SECTION
            : constants.MSG_COPY_SECTION;
    } else if (entryType == ENTRY_FLAG.TRANSACTIONS &&
            testFlag(allowedFlags, ENTRY_FLAG.TRANSACTIONS)) {
        msgId = isCut
            ? constants.MSG_MOVE_TRANSACTION
            : constants.MSG_COPY_TRANSACTION;
    } else {
        console.log("Unexpected entry type: " + entryType);
        return;
    }

    let toUnifiedId = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];

    if (isCut) {
        clearPaste();
    }

    mainWorker.postMessage([msgId, fromUnifiedId, toUnifiedId, prefs]);
}

function errMsg(err) {
    let msg = null;
    if (err.message) {
        msg = `${err.message} (${err.code})`;
    } else {
        msg = `Error code: ${err.code}`;
    }
    return msg;
}

window.onload = () => {
    'use strict';

    const mainTabs = new Tabs();
    mainTabs.addTab("ws_tab", "ws_panel");
    mainTabs.addTab("acc_tab", "acc_panel", onBeforeShowAccountsPanel);
    mainTabs.addTab("reports_tab", "reports_panel", onBeforeShowReportsPanel);

    let elems = document.getElementsByClassName("back_svg");
    Array.from(elems).forEach((e) => {
        let cls = e.disabled ? "disabled" : "";
        e.innerHTML =
            `<svg class="${cls}" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m0.77302 6.4234h11.159" />` +
            `<path d="m0.77742 6.3619 5.2143-5.2143" />` +
            `<path d="m0.77751 6.4607 5.2143 5.2143" />` +
            `</svg>`;
    });

    elems = document.getElementsByClassName("tick_svg");
    Array.from(elems).forEach((e) => {
        let cls = e.disabled ? "disabled" : "";
        e.innerHTML =
            `<svg class="${cls}" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m0.79375 6.35 2.1552 5.5563 8.9573-11.063"/>` +
            `</svg>`;
    });

    elems = document.getElementsByClassName("refresh_svg");
    Array.from(elems).forEach((e) => {
        let cls = e.disabled ? "disabled" : "";
        e.innerHTML =
            `<svg class="${cls}" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m11.523 6.3495a5.1729 5.1729 0 0 1-4.6424 5.1456 5.1729 5.1729 0 0 1-5.5946-4.0902 5.1729 5.1729 0 0 1 3.4949-5.9846 5.1729 5.1729 0 0 1 6.3114 2.8627"/>` +
            `<path d="m11.135 4.2444v-3.2485"/>` +
            `<path d="m7.8717 4.279h3.2485"/>` +
            `</svg>`;
    });

    elems = document.getElementsByClassName("settings_svg");
    Array.from(elems).forEach((e) => {
        let cls = e.disabled ? "disabled" : "";
        e.innerHTML =
            `<svg class="${cls}" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m5.7692 0.82424a5.5562 5.5562 0 0 1 1.1616-3e-8"/>` +
            `<path d="m5.7692 0.82424a5.5562 5.5562 0 0 1 1.1616-3e-8"/>` +
            `<path transform="rotate(45)" d="m8.3998-5.5268a5.5562 5.5562 0 0 1 1.1616 0"/>` +
            `<path transform="rotate(90)" d="m5.7691-11.878a5.5562 5.5562 0 0 1 1.1616 0"/>` +
            `<path transform="rotate(135)" d="m-0.58192-14.508a5.5562 5.5562 0 0 1 1.1616 0"/>` +
            `<path transform="scale(-1)" d="m-6.9328-11.878a5.5562 5.5562 0 0 1 1.1616 0"/>` +
            `<path transform="rotate(225)" d="m-9.5634-5.5265a5.5562 5.5562 0 0 1 1.1616-1e-7"/>` +
            `<path transform="rotate(-90)" d="m-6.9327 0.82438a5.5562 5.5562 0 0 1 1.1616-3e-8"/>` +
            `<path transform="rotate(-45)" d="m-0.58171 3.455a5.5562 5.5562 0 0 1 1.1616 0"/>` +
            `<circle cx="6.35" cy="6.35" r="1.0583"/>` +
            `<path transform="rotate(22.5)" d="m7.9102-0.2474a3.7041 3.7041 0 0 1 0.77438-3e-8"/>` +
            `<path transform="rotate(67.5)" d="m7.9112-7.1216a3.7041 3.7041 0 0 1 0.77438 0"/>` +
            `<path transform="rotate(112.5)" d="m3.0512-11.983a3.7041 3.7041 0 0 1 0.77438 0"/>` +
            `<path transform="rotate(157.5)" d="m-3.8231-11.984a3.7041 3.7041 0 0 1 0.77438 0"/>` +
            `<path transform="rotate(202.5)" d="m-8.6846-7.1241a3.7041 3.7041 0 0 1 0.77438-1e-7"/>` +
            `<path transform="rotate(247.5)" d="m-8.6856-0.24988a3.7041 3.7041 0 0 1 0.77438-2e-8"/>` +
            `<path transform="rotate(-67.5)" d="m-3.8255 4.6117a3.7041 3.7041 0 0 1 0.77438-1e-7"/>` +
            `<path transform="rotate(-22.5)" d="m3.0487 4.6127a3.7041 3.7041 0 0 1 0.77438 0"/>` +
            `<path d="m5.2972 2.7985 0.47198-1.9743"/>` +
            `<path d="m6.9308 0.82424 0.47198 1.9743"/>` +
            `<path d="m8.1182 3.0949 1.7294-1.0633"/>` +
            `<path d="m10.669 2.8529-1.0619 1.7308"/>` +
            `<path d="m9.9034 5.2991 1.9743 0.46994"/>` +
            `<path d="m11.878 6.9306-1.9743 0.47402"/>` +
            `<path d="m9.607 8.1201 1.0633 1.7273"/>` +
            `<path d="m9.849 10.669-1.7308-1.0598"/>` +
            `<path d="m7.4028 9.9053-0.46991 1.9723"/>` +
            `<path d="m5.7713 11.878-0.47405-1.9723"/>` +
            `<path d="m4.5818 9.6089-1.7273 1.0613"/>` +
            `<path d="m2.0332 9.8489 1.0598-1.7288"/>` +
            `<path d="m2.7966 7.4047-1.9723-0.47196"/>` +
            `<path d="m0.82438 5.7711 1.9723-0.472"/>` +
            `<path d="m3.093 4.5837-1.0613-1.7293"/>` +
            `<path d="m2.853 2.033 1.7288 1.0619"/>` +
            `</svg>`;
    });

    elems = document.getElementsByClassName("download_svg");
    Array.from(elems).forEach((e) => {
        let cls = e.disabled ? "disabled" : "";
        e.innerHTML =
            `<svg class="${cls}" version="1.1" viewBox="0 0 12.7 12.7" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="m6.35 0.78115v9.8148"/>` +
            `<path d="m2.6458 11.906h7.4083"/>` +
            `<path d="m6.35 10.686 3.175-3.0132"/>` +
            `<path d="m6.3501 10.686-3.175-3.0132"/>` +
            `</svg>`;
    });

    function disableSvgBtn(btnElem, isDiabled) {
        let svgElem = btnElem.childNodes[0];
        if (isDiabled) {
            svgElem.classList.add("disabled");
        } else {
            svgElem.classList.remove("disabled");
        }

        btnElem.disabled = isDiabled;
    }

    update_sort_icon();

    de("more_menu").addEventListener(
        "click",
        (event) => {
            event.stopPropagation();
            toggle_more_context_menu(de("more_context_menu"));
        });

    function hide_all_context_menus() {
        hide_wb_context_menu();
        hide_ws_context_menu();
        hide_ws_panel_context_menu();
        hide_acc_context_menu();
        hide_sec_context_menu();
        hide_txn_context_menu();
        hide_txn_panel_context_menu();
        hide_more_context_menu();
    }

    document.addEventListener(
        "click",
        () => {
            hide_all_context_menus();
        });

    document.addEventListener(
        "scroll",
        () => {
            hide_all_context_menus();
        });

    function show_context_menu(menu_elem, event) {
        hide_all_context_menus();

        let x = 0;
        if (event.clientX + menu_elem.clientWidth > document.documentElement.clientWidth) {
            x = document.documentElement.clientWidth - menu_elem.clientWidth - 8;
        } else {
            x = event.clientX;
        }

        let y = 0;
        if (event.clientY + menu_elem.clientHeight > document.documentElement.clientHeight) {
            y = document.documentElement.clientHeight - menu_elem.clientHeight - 8;
        } else {
            y = event.clientY;
        }

        menu_elem.style.left = `${x}px`;
        menu_elem.style.top = `${y}px`;

        menu_elem.classList.remove("hidden");
    }

    function toggle_more_context_menu(menu_elem) {
        if (menu_elem.classList.contains("hidden")) {
            menu_elem.classList.remove("hidden");
        } else {
            hide_more_context_menu();
        }
    }

    // Workbook context menu
    function hide_wb_context_menu() {
        let wb_menu = de("wb_context_menu");
        wb_menu.classList.add("hidden");
    }

    de("wb_context_del").addEventListener(
        "click",
        () => {
            let wb_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let wb_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_wb_context_menu();
            navigator.notification.confirm(
                `Are you sure you want to delete the worksheet named \"${wb_name}\"?`,
                (btn_idx) => {
                    if (btn_idx == 1) {
                        mainWorker.postMessage(
                            [constants.MSG_DEL_WORKBOOK, wb_id, prefs]);
                    }

                },
                "Confirm",
                ["Yes", "No"]);
        });

    de("wb_context_edit").addEventListener(
        "click",
        () => {
            let wb_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let wb_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_wb_context_menu();
            show_new_workbook(wb_id, wb_name, constants.ACTION.EDIT);
        });

    de("wb_context_dup").addEventListener(
        "click",
        () => {
            let wb_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let wb_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_wb_context_menu();
            show_new_workbook(wb_id, wb_name, constants.ACTION.DUP);
        });

    de("wb_context_paste").addEventListener(
        "click",
        () => {
            hide_wb_context_menu();
            pasteIf(ENTRY_FLAG.WORKSHEETS);
        });
    // Workbook context menu END

    // Workbook panel
    function sort_wb(sort_by, sort_icon_elem) {
        update_sort_ui(
            prefs[constants.PREF_SECTIONS.WORKBOOKS],
            sort_by,
            sort_icon_elem,
            de("wb_list_head"));
        mainWorker.postMessage([constants.MSG_WORKBOOKS, prefs]);
    }

    de("wb_col_name").addEventListener(
        "click",
        () => {
            sort_wb(SortBy.Name, de("wb_col_name_sort"));
        });

    de("wb_col_pending").addEventListener(
        "click",
        () => {
            sort_wb(SortBy.Amount, de("wb_col_pending_sort"));
        });

    function handleWBContextMenu(event, wb_id) {
        event.preventDefault();

        let row = event.target.parentElement;
        let menu = de("wb_context_menu");
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
            wb_id;
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME] =
            row.cells[0].innerText;

        enableContextMenuItem(
            de("wb_context_paste"),
            testPaste(ENTRY_FLAG.WORKSHEETS));

        show_context_menu(menu, event);

        event.stopPropagation();
    }

    function handleWBClick(event, wb_id) {
        let row = event.target.parentElement;

        de("ws_wb_name").innerText =
            `Workbooks > ${row.cells[0].textContent}`;
        de("ws_list").innerHTML = "";

        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
            wb_id;

        mainWorker.postMessage([
            constants.MSG_WORKSHEETS, wb_id, prefs]);

        make_active("ws_subpanel", "wb_subpanel");
    }

    function populate_wb_list(data) {
        let data_obj = JSON.parse(data);

        let tableHTML = "";
        for (let i = 0; i < data_obj.length; i++) {
            tableHTML += `<tr id="${data_obj[i][0]}" class="main">`
            tableHTML += `<td class="main">${data_obj[i][1]}</td>`;
            tableHTML += `<td class="main amount">${fmt_amt(data_obj[i][2])}</td>`
            tableHTML += `<td class="main contextMenu">&#x2807</td>`;
            tableHTML += `</tr>`;
        }
        de("wb_list").innerHTML = tableHTML;

        for (let i = 0; i < data_obj.length; i++) {
            let wb_id = data_obj[i][0];
            let wb_row = de(wb_id);

            wb_row.cells[0].addEventListener(
                "click",
                (event) => {
                    handleWBClick(event, wb_id);
                });

            wb_row.cells[1].addEventListener(
                "click",
                (event) => {
                    handleWBClick(event, wb_id);
                });

            wb_row.cells[2].addEventListener(
                "click",
                (event)  => {
                    handleWBContextMenu(event, wb_id);
                });

            wb_row.addEventListener(
                "contextmenu",
                (event)  => {
                    handleWBContextMenu(event, wb_id);
                });
        }
    }
    // Workbook panel end

    // Worksheet context menu
    function hide_ws_context_menu() {
        let ws_menu = de("ws_context_menu");
        ws_menu.classList.add("hidden");
    }

    function hide_ws_panel_context_menu() {
        let ws_panel_menu = de("ws_panel_context_menu");
        ws_panel_menu.classList.add("hidden");
    }

    de("ws_context_cut").addEventListener(
        "click",
        () => {
            let wsId = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            hide_ws_context_menu();
            setPaste(ENTRY_FLAG.WORKSHEETS, true, wsId);
        });

    de("ws_context_copy").addEventListener(
        "click",
        () => {
            let wsId = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            hide_ws_context_menu();
            setPaste(ENTRY_FLAG.WORKSHEETS, false, wsId);
        });

    de("ws_context_paste").addEventListener(
        "click",
        () => {
            hide_ws_context_menu();
            pasteIf(ENTRY_FLAG.WORKSHEETS | ENTRY_FLAG.SECTIONS);
        });

    de("ws_context_del").addEventListener(
        "click",
        () => {
            let ws_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let ws_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_ws_context_menu();
            navigator.notification.confirm(
                `Are you sure you want to delete the worksheet named \"${ws_name}\"?`,
                (btn_idx) => {
                    if (btn_idx == 1) {
                        mainWorker.postMessage(
                            [constants.MSG_DEL_WORKSHEET, ws_id, prefs]);
                    }
                },
                "Confirm",
                ["Yes", "No"]);
        });

    de("ws_context_edit").addEventListener(
        "click",
        () => {
            let ws_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let ws_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_ws_context_menu();
            show_new_worksheet(ws_id, ws_name, constants.ACTION.EDIT);
        });
    // Worksheet context menu END

    // Worksheet panel
    function sort_ws(sort_by, sort_icon_elem) {
        update_sort_ui(
            prefs[constants.PREF_SECTIONS.WORKSHEETS],
            sort_by,
            sort_icon_elem,
            de("ws_list_head"));
        mainWorker.postMessage([
            constants.MSG_WORKSHEETS,
            state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
            prefs]);
    }

    function onWsBackClick() {
        if (testWorkbooksFlag(ENTRY_FLAG.WORKBOOKS)) {
            mainWorker.postMessage([constants.MSG_WORKBOOKS, prefs]);
            clearWorkbooksFlags([ENTRY_FLAG.WORKBOOKS]);
        }

        make_active("wb_subpanel", "ws_subpanel");
    }

    de("ws_back").addEventListener(
        "click",
        onWsBackClick);

    de("ws_col_name").addEventListener(
        "click",
        () => {
            sort_ws(SortBy.Name, de("ws_col_name_sort"));
        });

    de("ws_col_pending").addEventListener(
        "click",
        () => {
            sort_ws(SortBy.Amount, de("ws_col_pending_sort"));
        });

    function handleWSClick(event, unified_ws_id) {
        let row = event.target.parentElement;
        let ws_name = row.cells[0].textContent;
        let wb_name = de("ws_wb_name").textContent;

        de("ws_txn_name").innerText = `${wb_name} > ${ws_name}`;
        de("ws_txn_list").innerHTML = "";
        de("ws_txn_pending").textContent = row.cells[1].textContent;

        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
            unified_ws_id;

        mainWorker.postMessage([
            constants.MSG_WS_TRANSACTIONS, unified_ws_id, prefs]);

        make_active("ws_txn_subpanel", "ws_subpanel");
    }

    function handleWSContextMenu(event, unified_ws_id) {
        event.preventDefault();

        let row = event.target.parentElement;
        let menu = de("ws_context_menu");
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
            unified_ws_id;
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME] =
            row.cells[0].innerText;

        enableContextMenuItem(
            de("ws_context_paste"),
            testPaste(
                ENTRY_FLAG.WORKSHEETS |
                ENTRY_FLAG.SECTIONS));

        show_context_menu(menu, event);

        event.stopPropagation();
    }

    function populate_ws_list(data) {
        let data_obj = JSON.parse(data);

        let tableHTML = "";
        for (let i = 0; i < data_obj.length; i++) {
            let unified_ws_id = data_obj[i][0];
            let ws_name = data_obj[i][1];
            let amt_disp = fmt_amt(data_obj[i][2]);

            tableHTML += `<tr id="${unified_ws_id}" class="main">`
            tableHTML += `<td class="main">${ws_name}</td>`;
            tableHTML += `<td class="main amount">${amt_disp}</td>`
            tableHTML += `<td class="main contextMenu">&#x2807</td>`;
            tableHTML += `</tr>`;
        }
        de("ws_list").innerHTML = tableHTML;

        for (let i = 0; i < data_obj.length; i++) {
            let unified_ws_id = data_obj[i][0];
            let ws_row = de(unified_ws_id);

            ws_row.cells[0].addEventListener(
                "click",
                (event) => {
                    handleWSClick(event, unified_ws_id);
                });

            ws_row.cells[1].addEventListener(
                "click",
                (event) => {
                    handleWSClick(event, unified_ws_id);
                });

            ws_row.cells[2].addEventListener(
                "click",
                (event) => {
                    handleWSContextMenu(event, unified_ws_id);
                });

            ws_row.addEventListener(
                "contextmenu",
                (event)  => {
                    handleWSContextMenu(event, unified_ws_id);
                });
        }
    }

    function handleWsContextPaste(event) {
        event.preventDefault();
        enableContextMenuItem(
            de("ws_panel_context_paste"),
            testPaste(ENTRY_FLAG.WORKSHEETS));
        show_context_menu(de("ws_panel_context_menu"), event);
        event.stopPropagation();
    }

    de("ws_subpanel").addEventListener(
        "contextmenu",
        (event) => {
            handleWsContextPaste(event);
        });

    de("ws_col_ctx").addEventListener(
        "click",
        (event) => {
            handleWsContextPaste(event);
        });

    de("ws_panel_context_paste").addEventListener(
        "click",
        () => {
            hide_ws_panel_context_menu();
            pasteIf(ENTRY_FLAG.WORKSHEETS);
        });
    // Worksheet panel END

    // New workbook dialog
    function show_new_workbook(wb_id, wb_name, action) {
        let wb_name_elem = de("wb_name");

        switch (action) {
            case constants.ACTION.NEW:
                de("new_wb_title").textContent = "New workbook";
                wb_name_elem.value = "";
                break;
            case constants.ACTION.EDIT:
                de("new_wb_title").textContent = "Rename workbook";
                state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
                    wb_id;
                wb_name_elem.value = wb_name;
                break;
            case constants.ACTION.DUP:
                de("new_wb_title").textContent = "Duplicate workbook";
                state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
                    wb_id;
                wb_name_elem.value = wb_name;
                break;
        }

        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] = action;
        disableSvgBtn(de("new_wb_save"), true);

        make_active("new_wb_page", "tabs_page");
        wb_name_elem.focus();
    }

    function hide_new_workbook() {
        make_active("tabs_page", "new_wb_page");
    }

    de("new_wb_btn").addEventListener(
        "click",
        () => {
            show_new_workbook(null, null, constants.ACTION.NEW);
        });

    de("new_wb_save").addEventListener(
        "click",
        () => {
            switch (state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION]) {
                case constants.ACTION.NEW:
                    mainWorker.postMessage(
                        [constants.MSG_NEW_WORKBOOK,
                        de("wb_name").value,
                        prefs]);
                    break;
                case constants.ACTION.EDIT:
                    mainWorker.postMessage(
                        [constants.MSG_EDIT_WORKBOOK,
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
                        de("wb_name").value,
                        prefs]);
                    break;
                case constants.ACTION.DUP:
                    mainWorker.postMessage(
                        [constants.MSG_DUP_WORKBOOK,
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
                        de("wb_name").value,
                        prefs]);
                    break;
            }
        });

    function onNewWbBackClick() {
        hide_new_workbook();
    }

    de("new_wb_back").addEventListener(
        "click",
        onNewWbBackClick);

    de("wb_name").addEventListener(
        "input",
        () => {
            disableSvgBtn(
                de("new_wb_save"),
                de("wb_name").value.trim().length == 0);
        });
    // New workbook dialog end

    // New worksheet dialog
    function show_new_worksheet(ws_id, ws_name, action) {
        let ws_name_elem = de("ws_name");

        de("new_ws_bread_crumb").textContent =
            de("ws_wb_name").textContent;

        switch (action) {
            case constants.ACTION.NEW:
                de("new_ws_title").textContent = "New worksheet";
                ws_name_elem.value = "";
                break;
            case constants.ACTION.EDIT:
                de("new_ws_title").textContent = "Rename worksheet";
                state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
                    ws_id;
                ws_name_elem.value = ws_name;
                break;
            case constants.ACTION.DUP:
                console.log("Invalid new worksheet action: " + action);
                return;
        }

        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] = action;
        disableSvgBtn(de("new_ws_save"), true);

        make_active("new_ws_page", "tabs_page");
        ws_name_elem.focus();
    }

    function hide_new_worksheet() {
        make_active("tabs_page", "new_ws_page");
    }

    de("new_ws_btn").addEventListener(
        "click",
        () => {
            show_new_worksheet(null, null, constants.ACTION.NEW);
        });

    de("new_ws_save").addEventListener(
        "click",
        () => {
            switch (state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION]) {
                case constants.ACTION.NEW:
                    mainWorker.postMessage(
                        [constants.MSG_NEW_WORKSHEET,
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
                        de("ws_name").value,
                        prefs]);
                    break;
                case constants.ACTION.EDIT:
                    mainWorker.postMessage(
                        [constants.MSG_EDIT_WORKSHEET,
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
                        de("ws_name").value,
                        prefs]);
                    break;
                case constants.ACTION.DUP:
                    constants.log("Invalid save worksheet action: " +
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION]);
                    break;
            }
        });

    de("new_ws_back").addEventListener(
        "click",
        () => {
            hide_new_worksheet();
        });

    de("ws_name").addEventListener(
        "input",
        () => {
            disableSvgBtn(
                de("new_ws_save"),
                de("ws_name").value.trim().length == 0);
        });
    // New worksheet dialog end

    // Section context menu
    function hide_sec_context_menu() {
        let sec_menu = de("sec_context_menu");
        sec_menu.classList.add("hidden");
    }

    de("sec_context_edit").addEventListener(
        "click",
        () => {
            let sec_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_sec_context_menu();
            show_new_section(sec_name, constants.ACTION.EDIT);
        });

    de("sec_context_cut").addEventListener(
        "click",
        () => {
            let secId = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            hide_sec_context_menu();
            setPaste(ENTRY_FLAG.SECTIONS, true, secId);
        });

    de("sec_context_copy").addEventListener(
        "click",
        () => {
            let secId = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            hide_sec_context_menu();
            setPaste(ENTRY_FLAG.SECTIONS, false, secId);
        });

    de("sec_context_paste").addEventListener(
        "click",
        () => {
            hide_sec_context_menu();
            pasteIf(ENTRY_FLAG.SECTIONS | ENTRY_FLAG.TRANSACTIONS);
        });

    de("sec_context_del").addEventListener(
        "click",
        () => {
            let sec_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let sec_name = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_sec_context_menu();
            navigator.notification.confirm(
                `Are you sure you want to delete the section \"${sec_name}\" and all its transactions?`,
                (btn_idx) => {
                    if (btn_idx == 1) {
                        mainWorker.postMessage(
                            [constants.MSG_DEL_SECTION, sec_id, prefs]);
                    }

                },
                "Confirm",
                ["Yes", "No"]);
        });
    // Section context menu END

    // Transaction context menu
    function hide_txn_context_menu() {
        let txn_menu = de("txn_context_menu");
        txn_menu.classList.add("hidden");
    }

    function hide_txn_panel_context_menu() {
        let txn_panel_menu = de("txn_panel_context_menu");
        txn_panel_menu.classList.add("hidden");
    }

    de("txn_context_cut").addEventListener(
        "click",
        () => {
            let txn_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            hide_txn_context_menu();
            setPaste(ENTRY_FLAG.TRANSACTIONS, true, txn_id);
        });

    de("txn_context_copy").addEventListener(
        "click",
        () => {
            let txn_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            hide_txn_context_menu();
            setPaste(ENTRY_FLAG.TRANSACTIONS, false, txn_id);
        });

    de("txn_context_paste").addEventListener(
        "click",
        () => {
            hide_txn_context_menu();
            pasteIf(ENTRY_FLAG.SECTIONS | ENTRY_FLAG.TRANSACTIONS);
        });

    de("txn_context_del").addEventListener(
        "click",
        () => {
            let txn_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let txn_desc = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME];
            hide_txn_context_menu();
            navigator.notification.confirm(
                `Are you sure you want to delete the transaction with the description \"${txn_desc}\"?`,
                (btn_idx) => {
                    if (btn_idx == 1) {
                        mainWorker.postMessage(
                            [constants.MSG_DEL_TRANSACTION, txn_id, prefs]);
                    }

                },
                "Confirm",
                ["Yes", "No"]);
        });
    // transaction context menu END

    // Worksheet transaction panel
    function onWsTxnBackClick() {
        if (testWorkbooksFlag(ENTRY_FLAG.WORKSHEETS)) {
            const wb_id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
            mainWorker.postMessage([constants.MSG_WORKSHEETS, wb_id, prefs]);
            clearWorkbooksFlags([ENTRY_FLAG.WORKSHEETS]);
        }

        make_active("ws_subpanel", "ws_txn_subpanel");
    }

    de("ws_txn_back").addEventListener(
        "click",
        onWsTxnBackClick);

    de("new_txn_btn").addEventListener(
        "click",
        () => {
            de("new_ws_txn_title").textContent = "New transaction";
            de("new_ws_txn_bread_crumb").textContent = de("ws_txn_name").textContent;

            de("txn_sec").disabled = false;

            let d = new Date();
            de("txn_date").valueAsDate =
                new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

            de("txn_amt").value = "0.00";

            let txn_desc = de("txn_desc");
            txn_desc.value = "";

            de("f-" + constants.ME_ACCOUNT_ID).selected = true;

            state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] =
                constants.ACTION.NEW;
            make_active("new_ws_txn_page", "tabs_page");
            txn_desc.focus();
        });

    function sort_ws_txn(sort_by, sort_icon_elem) {
        update_sort_ui(
            prefs[constants.PREF_SECTIONS.WS_TXNS],
            sort_by,
            sort_icon_elem,
            de("ws_txn_list_head"));
        let unified_ws_id =
            state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
        mainWorker.postMessage(
            [constants.MSG_WS_TRANSACTIONS, unified_ws_id, prefs]);
    }

    de("ws_txn_col_date").addEventListener(
        "click",
        () => {
            sort_ws_txn(SortBy.Date, de("ws_txn_col_date_sort"));
        });

    de("ws_txn_col_desc").addEventListener(
        "click",
        () => {
            sort_ws_txn(SortBy.Name, de("ws_txn_col_desc_sort"));
        });

    de("ws_txn_col_xfer_from").addEventListener(
        "click",
        () => {
            sort_ws_txn(SortBy.TransferFrom, de("ws_txn_col_xfer_from_sort"));
        });

    de("ws_txn_col_xfer_to").addEventListener(
        "click",
        () => {
            sort_ws_txn(SortBy.TransferTo, de("ws_txn_col_xfer_to_sort"));
        });

    de("ws_txn_col_amt").addEventListener(
        "click",
        () => {
            sort_ws_txn(SortBy.Amount, de("ws_txn_col_amt_sort"));
        });

    function handleWsSecContextMenu(event, sec_id) {
        event.preventDefault();

        let row = event.target.parentElement;
        let menu = de("sec_context_menu");
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
            sec_id;
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME] =
            row.cells[0].textContent

        enableContextMenuItem(
            de("sec_context_paste"),
            testPaste(
                ENTRY_FLAG.SECTIONS |
                ENTRY_FLAG.TRANSACTIONS));

        show_context_menu(menu, event);

        event.stopPropagation();
    }

    function handleWsTxnClick(event, unified_t_id) {
        mainWorker.postMessage([
            constants.MSG_START_EDIT_TRANSACTION,
            unified_t_id]);
    }

    function handleWsTxnContextMenu(event, unified_t_id) {
        event.preventDefault();

        let row = event.target.parentElement;
        let menu = de("txn_context_menu");
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] =
            unified_t_id;
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.NAME] =
            row.cells[1].textContent;

        enableContextMenuItem(
            de("txn_context_paste"),
            testPaste(
                ENTRY_FLAG.SECTIONS |
                ENTRY_FLAG.TRANSACTIONS));

        show_context_menu(menu, event);

        event.stopPropagation();
    }

    function populate_ws_txn_list(data) {
        let data_obj = JSON.parse(data);
        let section_obj = data_obj["sections"];
        let pending_amt = fmt_amt(data_obj["balance"]);
        new_ws_txn_clear_sec_select();

        let tableHTML = "";
        for (let section_i = 0; section_i < section_obj.length; section_i++) {
            if (section_i > 0) {
                tableHTML += `<tr><td colspan="5">&nbsp;</td></tr>`;
            }

            let sec_id = section_obj[section_i][0];
            let sec_name = section_obj[section_i][1];
            let sec_total = fmt_amt(section_obj[section_i][2]);

            tableHTML += `<tr id=${sec_id} class="main section">`;
            tableHTML += `<td colspan="4" class="main">${sec_name}</td>`;
            tableHTML += `<td class="main amount">${sec_total}</td>`;
            tableHTML += `<td class="main contextMenu">&#x2807</td>`;
            tableHTML += `</tr>`;

            new_ws_txn_add_sec_select(sec_id, sec_name);

            for (let i = 0; i < section_obj[section_i][3].length; i++) {
                let txn_obj = section_obj[section_i][3][i];

                tableHTML += `<tr id="${txn_obj[0]}" class="main">`
                tableHTML += `<td class="main">${txn_obj[1]}</td>`;
                tableHTML += `<td class="main">${txn_obj[2]}</td>`;
                tableHTML += `<td class="main" colspan="2">${txn_obj[3]} to `;
                tableHTML += `${txn_obj[4]}</td>`;
                tableHTML += `<td class="main amount squeeze">${fmt_amt(txn_obj[5])}</td>`
                tableHTML += `<td class="main contextMenu">&#x2807</td>`;
                tableHTML += `</tr>`;
            }
        }
        de("ws_txn_list").innerHTML = tableHTML;
        new_ws_txn_sel_sec_select(
            state[UI_SECTION.TRANSACTIONS][UI_SECTION_PROPERTY.LAST_SELECTED]);

        de("ws_txn_pending").textContent = pending_amt;

        for (let section_i = 0; section_i < section_obj.length; section_i++) {
            let sec_id = section_obj[section_i][0];
            let sec_row = de(sec_id);
            sec_row.addEventListener(
                "contextmenu",
                (event) => {
                    handleWsSecContextMenu(event, sec_id);
                });

            sec_row.cells[2].addEventListener(
                "click",
                () => {
                    handleWsSecContextMenu(event, sec_id);
                });

            for (let i = 0; i < section_obj[section_i][3].length; i++) {
                let unified_t_id = section_obj[section_i][3][i][0];
                let ws_txn_row = de(unified_t_id);

                for (let i = 0; i < 4; i++) {
                    ws_txn_row.cells[i].addEventListener(
                        "click",
                        (event) => {
                            handleWsTxnClick(event, unified_t_id);
                        });
                }

                ws_txn_row.cells[4].addEventListener(
                    "click",
                    (event) => {
                        handleWsTxnContextMenu(event, unified_t_id);
                    });

                ws_txn_row.addEventListener(
                    "contextmenu",
                    (event) => {
                        handleWsTxnContextMenu(event, unified_t_id);
                    });
            }
        }
    }

    function handleWsTxnContextPaste(event) {
        event.preventDefault();
        enableContextMenuItem(
            de("txn_panel_context_paste"),
            testPaste(ENTRY_FLAG.SECTIONS));
        show_context_menu(de("txn_panel_context_menu"), event);
        event.stopPropagation();
    }

    de("ws_txn_col_ctx").addEventListener(
        "click",
        (event) => {
            handleWsTxnContextPaste(event);
        });

    de("ws_txn_subpanel").addEventListener(
        "contextmenu",
        (event) => {
            handleWsTxnContextPaste(event);
        });

    de("txn_panel_context_paste").addEventListener(
        "click",
        () => {
            hide_txn_panel_context_menu();
            pasteIf(ENTRY_FLAG.SECTIONS);
        });
    // Worksheet transaction panel END

    // New worksheet transaction panel
    function activate_new_ws_txn_page(data, txn_id, action) {
        let data_obj = JSON.parse(data);
        if (data_obj.length == 0) {
            navigator.notification.alert(
                "Unable to find transaction", undefined, "Error");
            return;
        }

        switch (action) {
            case constants.ACTION.EDIT:
                de("new_ws_txn_title").textContent = "Edit transaction";
                break;
            default:
                console.log("Invalid new ws txn action: " + action);
                return;
        }

        de("new_ws_txn_bread_crumb").textContent = de("ws_txn_name").textContent;

        de("s-" + common.section_id_from_transaction_id(txn_id)).selected = true;
        de("txn_sec").disabled = true;

        de("txn_date").value = data_obj[0][0];
        de("txn_desc").value = data_obj[0][1];
        de("f-" + data_obj[0][2]).selected = true;
        de("t-" + data_obj[0][3]).selected = true;

        let txn_amt = de("txn_amt");
        txn_amt.value = data_obj[0][4];

        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID] = txn_id;
        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] = action;

        enable_new_ws_txn_save();

        make_active("new_ws_txn_page", "tabs_page");
        txn_amt.focus();
    }

    function enable_new_ws_txn_save() {
        disableSvgBtn(
            de("new_ws_txn_save"),
            (de("txn_desc").value.trim().length == 0 ||
            de("txn_amt").value.trim().length == 0));
    }

    de("txn_desc").addEventListener("input", enable_new_ws_txn_save);

    de("txn_amt").addEventListener("input", enable_new_ws_txn_save);

    function onNewWsTxnBackClick() {
        make_active("tabs_page", "new_ws_txn_page");
    }

    de("new_ws_txn_back").addEventListener(
        "click",
        onNewWsTxnBackClick);

    de("new_ws_txn_save").addEventListener(
        "click",
        () => {
            let sec_elem = de("txn_sec");
            let from_elem = de("txn_from");
            let to_elem = de("txn_to");
            let id = null;
            let msg_id = null;

            switch(state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION]) {
                case constants.ACTION.NEW:
                    id = sec_elem[sec_elem.selectedIndex].id.substring(2);
                    msg_id = constants.MSG_NEW_TRANSACTION;
                    break;

                case constants.ACTION.EDIT:
                    id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
                    msg_id = constants.MSG_EDIT_TRANSACTION;
                    break;

                default:
                    console.log("Invalid txn save action: " +
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION]);
                    return;
            }

            state[UI_SECTION.TRANSACTIONS][UI_SECTION_PROPERTY.LAST_SELECTED] = id;

            mainWorker.postMessage(
                [msg_id,
                id,
                de("txn_date").value,
                de("txn_desc").value,
                from_elem[from_elem.selectedIndex].id.substring(2),
                to_elem[to_elem.selectedIndex].id.substring(2),
                de("txn_amt").value,
                state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID],
                prefs]);
        });

    de("new_ws_txn_swap_ac_btn").addEventListener(
        "click",
        () => {
            let from_elem = de("txn_from");
            let to_elem = de("txn_to");
            let from_id = from_elem[from_elem.selectedIndex].id.substring(2);
            let to_id = to_elem[to_elem.selectedIndex].id.substring(2);
            from_elem.namedItem("f-" + to_id).selected = true;
            to_elem.namedItem("t-" + from_id).selected = true;
        });

    function new_ws_txn_clear_sec_select() {
        select_clear("txn_sec");
    }

    function new_ws_txn_add_sec_select(id, text) {
        select_add_option("txn_sec", "s-" + id, text);
    } 

    function new_ws_txn_sel_sec_select(id) {
        let e = de("txn_sec").namedItem("s-" + id);
        if (e) {
            e.selected = true;
        }
    }

    function new_ws_txn_clear_acc_select() {
        select_clear("txn_from");
        select_clear("txn_to");
    }

    function new_ws_txn_add_acc_select(id, text) {
        select_add_option("txn_from", "f-" + id, text);
        select_add_option("txn_to", "t-" + id, text);
    } 
    // New worksheet transaction panel END

    // New section dialog
    function show_new_section(sec_name, action) {
        let sec_name_elem = de("sec_name");
        let make_inactive_id = "tabs_page";

        de("new_sec_bread_crumb").textContent =
            de("ws_wb_name").textContent;

        switch (action) {
            case constants.ACTION.NEW:
                de("new_sec_title").textContent = "New section";
                make_inactive_id = "new_ws_txn_page";
                sec_name_elem.value = "";
                break;
            case constants.ACTION.EDIT:
                de("new_sec_title").textContent = "Rename section";
                sec_name_elem.value = sec_name;
                break;
            default:
                navigator.notification.alert(
                    "Invalid section action", undefined, "Error");
                return;
        }

        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] = action;
        disableSvgBtn(de("new_sec_save"), true);

        make_active("new_sec_page", make_inactive_id);
        sec_name_elem.focus();
    }

    function hide_new_section() {
        let make_active_id = "tabs_page";
        if (state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION] ==
                constants.ACTION.NEW) {
            make_active_id = "new_ws_txn_page";
        }
        make_active(make_active_id, "new_sec_page");
    }

    de("new_sec_btn").addEventListener(
        "click",
        () => {
            show_new_section(null, constants.ACTION.NEW);
        });

    de("new_sec_save").addEventListener(
        "click",
        () => {
            let sec_name = de("sec_name").value;
            let id = null;
            let msg_id = null;

            switch (state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.ACTION]) {
                case constants.ACTION.NEW:
                    // id is the id of the worksheet
                    id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
                    msg_id = constants.MSG_NEW_SECTION;
                    break;

                case constants.ACTION.EDIT:
                    // id is the id of the section
                    id = state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID];
                    msg_id = constants.MSG_EDIT_SECTION;
                    break;

                default:
                    navigator.notification.alert(
                        "Invalid section action", undefined, "Error");
                    return;
            }

            mainWorker.postMessage([msg_id, id, sec_name, prefs]);
        });

    function onNewSecBackClick() {
        hide_new_section();
    }

    de("new_sec_back").addEventListener(
        "click",
        onNewSecBackClick);

    de("sec_name").addEventListener(
        "input",
        () => {
            disableSvgBtn(
                de("new_sec_save"),
                de("sec_name").value.trim().length == 0);
        });
    // New section dialog end

    // Account context menu
    function hide_acc_context_menu() {
        let acc_menu = de("acc_context_menu");
        acc_menu.classList.add("hidden");
    }

    de("acc_context_del").addEventListener(
        "click",
        () => {
            let acc_id = state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let acc_name = state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.NAME];
            hide_acc_context_menu();

            if (acc_id == constants.ME_ACCOUNT_ID) {
                // Worker will return an error async, which will be converted
                // to a notification. Therefore, no need to ask for confirmation
                mainWorker.postMessage(
                    [constants.MSG_DEL_ACCOUNT, acc_id, prefs]);
                return;
            }

            navigator.notification.confirm(
                `Are you sure you want to delete the account named \"${acc_name}\"?`,
                (btn_idx) => {
                    if (btn_idx == 1) {
                        mainWorker.postMessage(
                            [constants.MSG_DEL_ACCOUNT, acc_id, prefs]);
                    }

                },
                "Confirm",
                ["Yes", "No"]);
        });

    de("acc_context_edit").addEventListener(
        "click",
        () => {
            let acc_id = state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID];
            let acc_name = state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.NAME];
            hide_acc_context_menu();
            show_new_account(acc_id, acc_name, constants.ACTION.EDIT);
        });
    // Account context menu END

    // Accounts panel
    function sort_ac(sort_by, sort_icon_elem) {
        update_sort_ui(
            prefs[constants.PREF_SECTIONS.ACCOUNTS],
            sort_by,
            sort_icon_elem,
            de("acc_list_head"));
        mainWorker.postMessage([constants.MSG_ACCOUNTS, prefs]);
    }

    de("acc_col_name").addEventListener(
        "click",
        () => {
            sort_ac(SortBy.Name, de("acc_col_name_sort"));
        });

    de("acc_col_tot").addEventListener(
        "click",
        () => {
            sort_ac(SortBy.Amount, de("acc_col_tot_sort"));
        });

    de("new_acc_btn").addEventListener(
        "click",
        () => {
            show_new_account(null, null, constants.ACTION.NEW);
        });

    function populate_acc_list(data) {
        let data_obj = JSON.parse(data);
        new_ws_txn_clear_acc_select();

        let tableHTML = "";
        for (let i = 0; i < data_obj.length; i++) {
            let amt_disp = fmt_amt(data_obj[i][2]);
            tableHTML += `<tr id="${data_obj[i][0]}" class="main">`
            tableHTML += `<td class="main">${data_obj[i][1]}</td>`;
            tableHTML += `<td class="main amount">${amt_disp}</td>`
            tableHTML += `</tr>`;

            new_ws_txn_add_acc_select(data_obj[i][0], data_obj[i][1]);
        }
        de("acc_list").innerHTML = tableHTML;

        for (let i = 0; i < data_obj.length; i++) {
            let acc_row = de(data_obj[i][0]);
            acc_row.addEventListener(
                "contextmenu",
                (event)  => {
                    event.preventDefault();

                    let row = event.target.parentElement;
                    let menu = de("acc_context_menu");
                    state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID] =
                        row.id;
                    state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.NAME] =
                        row.cells[0].innerText;
                    show_context_menu(menu, event);
                });
        }
    }
    // Accounts panel END

    // New account sub-panel
    function show_new_account(acc_id, acc_name, action) {
        let acc_name_elem = de("acc_name");

        switch (action) {
            case constants.ACTION.NEW:
                de("new_acc_title").textContent = "New account";
                acc_name_elem.value = "";
                break;
            case constants.ACTION.EDIT:
                de("new_acc_title").textContent = "Rename account";
                state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID] =
                    acc_id;
                acc_name_elem.value = acc_name;
                break;
        }

        state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.ACTION] = action;
        disableSvgBtn(de("new_acc_save"), true);

        make_active("new_acc_page", "tabs_page");
        acc_name_elem.focus();
    }

    function hide_new_account() {
        make_active("tabs_page", "new_acc_page");
    }

    de("new_acc_save").addEventListener(
        "click",
        () => {
            switch (state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.ACTION]) {
                case constants.ACTION.NEW:
                    mainWorker.postMessage(
                        [constants.MSG_NEW_ACCOUNT,
                        de("acc_name").value,
                        prefs]);
                    break;
                case constants.ACTION.EDIT:
                    mainWorker.postMessage(
                        [constants.MSG_EDIT_ACCOUNT,
                        state[UI_SECTION.ACCOUNTS][UI_SECTION_PROPERTY.UNIFIED_ID],
                        state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
                        de("acc_name").value,
                        prefs]);
                    break;
            }
        });

    function onNewAcBackClick() {
        hide_new_account();
    }

    de("new_acc_back").addEventListener(
        "click",
        onNewAcBackClick);

    de("acc_name").addEventListener(
        "input",
        () => {
            disableSvgBtn(
                de("new_acc_save"),
                de("acc_name").value.trim().length == 0);
        });
    // New account sub-panel END

    // Reports panel
    function refresh_report() {
        let report_type = null;
        let exclude_wb_ids = [];
        let select_elem = de("report_type_sel");
        switch (select_elem[select_elem.selectedIndex].id) {
            case "settle_report":
                report_type = constants.REPORT.SETTLE;
                exclude_wb_ids = prefs
                    [constants.PREF_SECTIONS.SETTLE_REPORT]
                    [constants.PREF_PROPERTY.EXCLUDE_LIST]
                break;
            case "acc_txn_report":
                report_type = constants.REPORT.ACC_TXN;
                exclude_wb_ids = prefs
                    [constants.PREF_SECTIONS.AC_TXN_REPORT]
                    [constants.PREF_PROPERTY.EXCLUDE_LIST]
                break;
        }

        let exclude_wb_ids_json = JSON.stringify(exclude_wb_ids);
        mainWorker.postMessage([
            constants.MSG_REPORT, report_type, exclude_wb_ids_json]);
    }

    function onBeforeShowReportsPanel() {
        refresh_report();
    }

    de("report_type_sel").addEventListener(
        "change",
        () => {
            refresh_report();
        });

    de("refresh_report").addEventListener(
        "click",
        () => {
            refresh_report();
        });

    de("report_settings").addEventListener(
        "click",
        () => {
            let msg_id = null;
            let report_prefs = {};
            let select_elem = de("report_type_sel");
            switch (select_elem[select_elem.selectedIndex].id) {
                case "settle_report":
                    msg_id = constants.MSG_SETTLE_REPORT_SETTINGS;
                    report_prefs = prefs[constants.PREF_SECTIONS.SETTLE_REPORT];
                    break;
                case "acc_txn_report":
                    msg_id = constants.MSG_AC_TXN_REPORT_SETTINGS;
                    report_prefs = prefs[constants.PREF_SECTIONS.AC_TXN_REPORT];
                    break;
            }

            mainWorker.postMessage([msg_id, report_prefs]);
        });

    de("save_report").addEventListener(
        "click",
        (e) => {
            let report_content_elem = de("report_content");
            let report_type = state[UI_SECTION.REPORTS][UI_SECTION_PROPERTY.TYPE];
            if (!report_type) {
                navigator.notification.alert(
                    "Unable to save report (unexpected)", undefined, "Error");
                return;
            }

            select_save_file(
                report_type, report_content_elem.srcdoc,
                "Saved report", "Unable to save report");
        });

    function show_report_state() {
        let is_filtered = false;
        switch (state[UI_SECTION.REPORTS][UI_SECTION_PROPERTY.TYPE]) {
            case constants.REPORT.SETTLE:
                if (prefs
                        [constants.PREF_SECTIONS.SETTLE_REPORT]
                        [constants.PREF_PROPERTY.EXCLUDE_LIST]
                        .length > 0) {
                    is_filtered = true;
                }
                break;
            case constants.REPORT.ACC_TXN:
                if (prefs
                        [constants.PREF_SECTIONS.AC_TXN_REPORT]
                        [constants.PREF_PROPERTY.EXCLUDE_LIST]
                        .length > 0) {
                    is_filtered = true;
                }
                break;
        }

        let report_state = de("report_state");
        if (is_filtered) {
            report_state.classList.add("tag");
            report_state.innerHTML = "Filtered";
        } else {
            report_state.classList.remove("tag");
            report_state.innerHTML = "";
        }
    }

    function displayReport(html_str, report_type) {
        let report_content_elem = de("report_content");
        report_content_elem.srcdoc = html_str;
        state[UI_SECTION.REPORTS][UI_SECTION_PROPERTY.TYPE] = report_type;
        show_report_state();
        disableSvgBtn(de("save_report"), false);
    }
    // Reports panels end

    // Settle report settings
    function show_settle_report_settings(wbs_json) {
        populate_exclude_wbs(
            de("settle_report_exclude_wbs"), "sr-", wbs_json,
            prefs[constants.PREF_SECTIONS.SETTLE_REPORT][constants.PREF_PROPERTY.EXCLUDE_LIST]);
        make_active("settle_report_settings_page", "tabs_page");
    }

    function hide_settle_report_settings() {
        de("settle_report_exclude_wbs").innerHTML = "";
        make_active("tabs_page", "settle_report_settings_page");
    }

    function onSettleReportSettingsBackClick() {
        hide_settle_report_settings();
    }

    de("settle_report_settings_back").addEventListener(
        "click",
        onSettleReportSettingsBackClick);

    de("settle_report_settings_save").addEventListener(
        "click",
        () => {
            prefs[constants.PREF_SECTIONS.SETTLE_REPORT][constants.PREF_PROPERTY.EXCLUDE_LIST] =
                get_exclude_wbs_list(de("settle_report_exclude_wbs"), "sr-");
            save_prefs();
            refresh_report();
            hide_settle_report_settings();
        });
    // Settle report settings END

    // Account transaction report settings
    function show_ac_txn_report_settings(wbs_json) {
        populate_exclude_wbs(
            de("ac_txn_report_exclude_wbs"), "atr-", wbs_json,
            prefs[constants.PREF_SECTIONS.AC_TXN_REPORT][constants.PREF_PROPERTY.EXCLUDE_LIST]);
        make_active("ac_txn_report_settings_page", "tabs_page");
    }

    function hide_ac_txn_report_settings() {
        de("ac_txn_report_exclude_wbs").innerHTML = "";
        make_active("tabs_page", "ac_txn_report_settings_page");
    }

    function onAcTxnReportSettingsBackClick() {
        hide_ac_txn_report_settings();
    }

    de("ac_txn_report_settings_back").addEventListener(
        "click",
        onAcTxnReportSettingsBackClick);

    de("ac_txn_report_settings_save").addEventListener(
        "click",
        () => {
            prefs[constants.PREF_SECTIONS.AC_TXN_REPORT][constants.PREF_PROPERTY.EXCLUDE_LIST] =
                get_exclude_wbs_list(de("ac_txn_report_exclude_wbs"), "atr-");
            save_prefs();
            refresh_report();
            hide_ac_txn_report_settings();
        });
    // Account transaction report settings END

    // More context menu
    function hide_more_context_menu() {
        let more_menu = de("more_context_menu");
        more_menu.classList.add("hidden");
    }

    de("more_context_import").addEventListener(
        "click",
        () => {
            hide_more_context_menu();
            select_file(".mtw")
                .then((file) => {
                    return read_file_content(file);
                }).then((content) => {
                    mainWorker.postMessage(
                        [constants.MSG_IMPORT,
                            state[UI_SECTION.WORKBOOKS][UI_SECTION_PROPERTY.UNIFIED_ID],
                            prefs, content],
                        [content]);
                });
        });

    de("more_context_export").addEventListener(
        "click",
        () => {
            hide_more_context_menu();
            mainWorker.postMessage([constants.MSG_EXPORT]);
        });
    // More context menu END

    function main_worker_message_handler(e) {
        switch (e.data[0]) {
            case constants.MSG_INIT:
                load_workbooks();
                break;

            case constants.MSG_WORKBOOKS:
                populate_wb_list(e.data[1]);
                break;

            case constants.MSG_NEW_WORKBOOK:
            case constants.MSG_EDIT_WORKBOOK:
            case constants.MSG_DUP_WORKBOOK:
                hide_new_workbook();
                break;

            case constants.MSG_WORKSHEETS:
                populate_ws_list(e.data[1]);
                break;

            case constants.MSG_EDIT_WORKSHEET:
            case constants.MSG_MOVE_WORKSHEET:
            case constants.MSG_COPY_WORKSHEET:
                setWorkbooksFlags([ENTRY_FLAG.WORKBOOKS]);
                setAccountsFlags([ENTRY_FLAG.ACCOUNTS]);
                // fall thru
            case constants.MSG_NEW_WORKSHEET:
                hide_new_worksheet();
                break;

            case constants.MSG_NEW_SECTION:
                new_ws_txn_sel_sec_select(e.data[1]);
                // fall thru
            case constants.MSG_MOVE_SECTION:
            case constants.MSG_COPY_SECTION:
                setWorkbooksFlags([
                    ENTRY_FLAG.WORKSHEETS, ENTRY_FLAG.WORKBOOKS]);
                setAccountsFlags([ENTRY_FLAG.ACCOUNTS]);
                // fall thru
            case constants.MSG_EDIT_SECTION:
                hide_new_section();
                break;

            case constants.MSG_WS_TRANSACTIONS:
                populate_ws_txn_list(e.data[1]);
                break;

            case constants.MSG_NEW_TRANSACTION:
            case constants.MSG_EDIT_TRANSACTION:
            case constants.MSG_MOVE_TRANSACTION:
            case constants.MSG_COPY_TRANSACTION:
                setWorkbooksFlags([
                    ENTRY_FLAG.WORKSHEETS, ENTRY_FLAG.WORKBOOKS]);
                setAccountsFlags([ENTRY_FLAG.ACCOUNTS]);
                make_active("tabs_page", "new_ws_txn_page");
                break;

            case constants.MSG_START_EDIT_TRANSACTION:
                activate_new_ws_txn_page(
                    e.data[1], e.data[2], constants.ACTION.EDIT);
                break;

            case constants.MSG_ACCOUNTS:
                populate_acc_list(e.data[1]);
                break;

            case constants.MSG_NEW_ACCOUNT:
            case constants.MSG_EDIT_ACCOUNT:
                hide_new_account();
                break;

            case constants.MSG_LOAD_WORKBOOKS:
                load_worksheets(e.data[1]);
                break;

            case constants.MSG_SAVE:
                saveFile(e.data[1], e.data[2], e.data[3]);
                break;

            case constants.MSG_ERROR:
                navigator.notification.alert(e.data[1], undefined, "Error");
                break;

            case constants.MSG_IMPORT:
                break;

            case constants.MSG_EXPORT:
                select_save_file(
                    app_storage.EXPORT, e.data[1], "Exported", "Unable to export");
                break;

            case constants.MSG_REPORT:
                displayReport(e.data[1], e.data[2]);
                break;

            case constants.MSG_DEL_WORKBOOK:
                new AppStorage(app_storage.DIR_IN_CURRENT_DIR, null, e.data[1])
                    .deleteDirRecursive()
                    .catch((err) => {
                        if (err instanceof DOMException) {
                            navigator.notification.alert(
                                `Unable to delete workbook from storage - "${err.message}"`,
                                undefined, "Error");
                        }
                    });
                break;

            case constants.MSG_DEL_WORKSHEET:
                new AppStorage(app_storage.SOME_ID, e.data[1], e.data[2])
                    .deleteFile()
                    .catch((err) => {
                        if (err instanceof DOMException) {
                            navigator.notification.alert(
                                `Unable to delete worksheet from storage - "${err.message}"`,
                                undefined, "Error");
                        }
                    });
                break;

            case constants.MSG_DEL_TRANSACTION:
                setWorkbooksFlags([
                    ENTRY_FLAG.WORKSHEETS, ENTRY_FLAG.WORKBOOKS]);
                setAccountsFlags([ENTRY_FLAG.ACCOUNTS]);
                break;

            case constants.MSG_DEL_ACCOUNT:
                break;

            case constants.MSG_SETTLE_REPORT_SETTINGS:
                show_settle_report_settings(e.data[1]);
                break;

            case constants.MSG_AC_TXN_REPORT_SETTINGS:
                show_ac_txn_report_settings(e.data[1]);
                break;
        }
    }

    function main() {
        mainWorker = new Worker("./js/main_worker.js", {type: "module"});
        if (!mainWorker) {
            console.log("Worker create failed!");
            return;
        }

        load_prefs();

        mainWorker.addEventListener(
            "message",
            main_worker_message_handler);

        fetch("./wasm/main_bg.wasm")
            .then((response) => response.arrayBuffer())
            .then((bytes) => {
                mainWorker.postMessage([constants.MSG_INIT, bytes], [bytes]);
            })
            .catch(() => {
                navigator.notification.alert(
                    "Unable to initialize application (unexpected)", undefined, "Warning");
            });
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    if (cordova.platformId == "browser" && 
            (userAgent.includes("chrome") ||
            userAgent.includes("crios") ||
            userAgent.includes("chromium"))) {
        window.addEventListener('filePluginIsReady', () => { main(); }, false);
    } else {
        window.setTimeout(main, 1000);
    }

    document.addEventListener(
        "backbutton",
        (e) => {
            if (!de("new_ws_txn_page").classList.contains("inactive")) {
                onNewWsTxnBackClick();
            } else if (!de("new_sec_page").classList.contains("inactive")) {
                onNewSecBackClick();
            } else if (!de("ws_txn_subpanel").classList.contains("inactive")) {
                onWsTxnBackClick();
            } else if (!de("ws_subpanel").classList.contains("inactive")) {
                onWsBackClick();
            } else if (!de("new_wb_page").classList.contains("inactive")) {
                onNewWbBackClick();
            } else if (!de("new_acc_page").classList.contains("inactive")) {
                onNewAcBackClick();
            } else if (!de("settle_report_settings_page").classList.contains("inactive")) {
                onSettleReportSettingsBackClick();
            } else if (!de("ac_txn_report_settings_page").classList.contains("inactive")) {
                onAcTxnReportSettingsBackClick();
            } else {
                navigator.notification.confirm(
                    "Are you sure you want to exit?",
                    (buttonIndex) => {
                        if (buttonIndex == 1) {
                            navigator.app.exitApp();
                        }
                    },
                    "Exit",
                    ["Exit", "Cancel"]);
            }
        },
        false);
}

function onPause() {
    save_prefs();
}