class TableManager {
    constructor(container_element, row_creator) {
        this.container = container_element;
        this.createRow = row_creator;
        this.removeRow = (element) => {
            element.remove();
        };
        this.insertFirstRow = (element) => {
            this.container.insertBefore(element, this.container.firstChild);
        };
        this.appendRow = (element) => {
            this.container.appendChild(element);
        };
        this.getRowState = (element, key) => {
            return element.getAttribute("data-" + key);
        };
        this.count = () => this.container.childElementCount;
    }
}

function createOneRow(data, state) {
    let row = document.createElement("tr");
    row.setAttribute("data-group", "message-row");
    row.innerHTML =
        // <td class="col col-message-id hidden" data-name="MessageId"></td>
        //  <td class="col col-thread-id hidden" data-name="ThreadId"></td>
        `<td class="col col-from" data-name="From"></td>
         <td class="col col-to" data-name="To"></td>
         <td class="col col-subject" data-name="Subject"></td>
         <td class="col col-time" data-name="Date"></td>
         <td class="col-controls">
             <ul class="btn-container flex-row">
                 <li class="btn btn-icon" data-group="row-trash" style="color: red;">
                     <i class="fa-solid fa-trash"></i>
                 </li>
             </ul>
         </td>`
    for (const item of row.getElementsByTagName("td")) {
        let row_name = item.getAttribute("data-name");
        if (row_name) {
            item.title = data[row_name].title || data[row_name] || "";
            item.innerText = data[row_name].value || data[row_name] || "";
        }
    }
    for (const name in state) {
        row.setAttribute("data-" + name, state[name]);
    }
    return row;
}
