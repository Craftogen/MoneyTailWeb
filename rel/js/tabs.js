export default class Tabs {
    constructor() {
        this.tabs = [];
    }

    addTab(tabId, panelId, beforeShowEvent) {
        this.tabs.push([tabId, panelId]);
        let tab = document.getElementById(tabId);
        tab.addEventListener("click", (event) => {
            if (beforeShowEvent) {
                beforeShowEvent(event);
            }

            this.showTabPanel(event.target.id);
        });
    }

    showTabPanel(tabId) {
        for (const elem of this.tabs) {
            let tab = document.getElementById(elem[0]);
            let panel = document.getElementById(elem[1]);
            if (tab.id == tabId) {
                tab.classList.add("active");
                panel.classList.remove("inactive");
            } else {
                tab.classList.remove("active");
                panel.classList.add("inactive");
            }
        }
    }
}
