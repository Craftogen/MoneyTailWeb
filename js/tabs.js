export default class Tabs {
    constructor() {
        this.tabs = [];
    }

    addTab(
            tabId, panelId,
            beforeShowEvent, afterShowEvent,
            beforeHideEvent, afterHideEvent) {
        this.tabs.push([
            tabId, panelId,
            beforeShowEvent, afterShowEvent,
            beforeHideEvent, afterHideEvent]);
        let tab = document.getElementById(tabId);
        tab.addEventListener("click", (event) => {
            this.showTabPanel(event);
        });
    }

    showTabPanel(event) {
        const tabId = event.target.id;

        // Hide first
        for (const elem of this.tabs) {
            const tab = document.getElementById(elem[0]);
            const panel = document.getElementById(elem[1]);
            const beforeHideEvent = elem[4];
            const afterHideEvent = elem[5];

            if (tab.id != tabId &&
                    tab.classList.contains("active")) {
                if (beforeHideEvent) {
                    beforeHideEvent(event);
                }

                tab.classList.remove("active");
                panel.classList.add("inactive");

                if (afterHideEvent) {
                    afterHideEvent(event);
                }
            }
        }

        // Show next
        for (const elem of this.tabs) {
            const tab = document.getElementById(elem[0]);
            const panel = document.getElementById(elem[1]);
            const beforeShowEvent = elem[2];
            const afterShowEvent = elem[3];

            if (tab.id == tabId &&
                    !tab.classList.contains("active")) {
                if (beforeShowEvent) {
                    beforeShowEvent(event);
                }

                tab.classList.add("active");
                panel.classList.remove("inactive");

                if (afterShowEvent) {
                    afterShowEvent(event);
                }
            }
        }
    }
}
