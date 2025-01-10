import { addDragAndDropToVectorsetList, addDragAndDropHandlers } from "./dragAndDrop.js";
import { setCurrentFileName } from "./dataStore.js";
import { openVectorTableInNewWindow } from "./modals.js";
import { projectSelect, domainSelect, evtVersionSelect, fileNameDisplay, vectorTable } from "./init.js";
import { setVectorData, getVectorData, getCurrentRowIndex } from "./dataStore.js";

export function populateSelect(selectElement, items) {
    selectElement.innerHTML = '';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        selectElement.appendChild(option);
    });
}

export function populateTable(table, groupedItems) {
    table.innerHTML = '';
    groupedItems.forEach(item => {
        const row = document.createElement('tr');

        const vectorNameCell = document.createElement('td');
        vectorNameCell.textContent = item.vector_name;
        vectorNameCell.classList.add('vectorset-column');
        vectorNameCell.setAttribute('title', item.vector_name);
        row.appendChild(vectorNameCell);

        const ownerCell = document.createElement('td');
        ownerCell.textContent = item.owner;
        row.appendChild(ownerCell);

        const modifiedCell = document.createElement('td');
        const selectElement = document.createElement('select');
        item.modified.forEach((dateString, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = formatDate(dateString);
            selectElement.appendChild(option);
        });
        modifiedCell.appendChild(selectElement);
        row.appendChild(modifiedCell);

        const loadButtonCell = document.createElement('td');
        const loadButton = document.createElement('button');
        loadButton.textContent = 'LOAD';
        loadButton.classList.add('btn', 'btn-secondary', 'btn-sm');
        loadButton.addEventListener('click', function() {
            const selectedIndex = selectElement.value;
            const selectedFileName = item.fileNames[selectedIndex];
            const project = projectSelect.value;
            const evtVersion = evtVersionSelect.value;
            const domain = domainSelect.value;

            vectorDetails.textContent = `${project} > ${evtVersion} > ${domain} > ${item.vector_name}`;
            fileNameDisplay.textContent = selectedFileName;

            loadVectorData(selectedFileName);
        });
        loadButtonCell.appendChild(loadButton);
        row.appendChild(loadButtonCell);

        addDragAndDropToVectorsetList(row, item);
        table.appendChild(row);
    });
}

function loadVectorData(fileName) {
    fetch(`/api/v1/va/vector-list?file_name=${fileName}`)
        .then(response => response.json())
        .then(data => {
            setVectorData(data.items);
            populateVectorTable(vectorTable, getVectorData());
            setCurrentFileName(fileName);
        })
        .catch(error => console.error('Error loading vector data:', error));
}

export function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}.${month}.${day}. ${hours}:${minutes}:${seconds}`;
}

export function populateVectorTable(table, items) {
    table.innerHTML = '';
    items.forEach((item, rowIndex) => {
        const row = document.createElement('tr');

        // Index
        const indexCell = document.createElement('td');
        indexCell.textContent = item.index;
        row.appendChild(indexCell);

        // Vectorset: "linked"가 1일 때 linked_vectorset.vectorset_name을 사용
        const vectorsetCell = document.createElement('td');
        if (item.linked === 1) {
            let vectorsetName = item.linked_vectorset.vectorset_name.replace(/^🔗|📌/,'');
            const latest_icon = item.linked_vectorset.latest === 1 ? '🔗' : '📌';
            vectorsetCell.textContent = `${latest_icon}${vectorsetName}`;
            vectorsetCell.classList.add('vectorset-column');
            vectorsetCell.setAttribute('title', item.linked_vectorset.vectorset_name);
            vectorsetCell.setAttribute('data-file-name', item.linked_vectorset.file_name);
            vectorsetCell.setAttribute('data-latest', item.linked_vectorset.latest);

            //click event
            vectorsetCell.addEventListener('click', function() {
                const fileName = item.linked_vectorset.file_name;
                const latest = item.linked_vectorset.latest;
                openVectorTableInNewWindow(fileName, latest);
            });
        } else {
            vectorsetCell.textContent = '';
        }
        row.appendChild(vectorsetCell);

        // Control Name
        const controlNameCell = document.createElement('td');
        controlNameCell.textContent = item.control_name;
        makeEditable(controlNameCell, item, 'control_name', rowIndex, 2);
        row.appendChild(controlNameCell);

        // Address
        const addressCell = document.createElement('td');
        addressCell.textContent = item.address;
        makeEditable(addressCell, item, 'address', rowIndex, 3);
        row.appendChild(addressCell);

        // Data
        const dataCell = document.createElement('td');
        dataCell.textContent = item.data;
        makeEditable(dataCell, item, 'data', rowIndex, 4);
        row.appendChild(dataCell);

        // 드래그 핸들 추가 및 드래그 앤 드롭 이벤트 추가
        addDragAndDropHandlers(row);

        table.appendChild(row);
    });

    function makeEditable(cell, item, field, rowIndex, cellIndex) {
        cell.addEventListener('dblclick', function() {
            cell.contentEditable = true;
            cell.focus();
            selectAllText(cell);
        });

        cell.addEventListener('blur', function() {
            cell.contentEditable = false;
            item[field] = cell.textContent;
        });

        cell.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                cell.blur();
                moveToCell(rowIndex + 1, cellIndex);
            } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                cell.blur();
                const isLastCell = (cellIndex === table.rows[rowIndex].cells.length - 2);
                if (isLastCell) {
                    moveToCell(rowIndex + 1, 2);
                } else {
                    moveToCell(rowIndex, cellIndex + 1);
                }
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                cell.blur();
                const isFirstCell = (cellIndex === 2);
                if (isFirstCell) {
                    moveToCell(rowIndex - 1, table.rows[0].cells.length - 2);
                } else {
                    moveToCell(rowIndex, cellIndex - 1);
                }
            }
        });
    }

    function moveToCell(rowIndex, cellIndex) {
        const rows = table.getElementsByTagName('tr');
        if (rows[rowIndex]) {
            const targetCell = rows[rowIndex].getElementsByTagName('td')[cellIndex];
            if (targetCell) {
                targetCell.contentEditable = true;
                targetCell.focus();
                selectAllText(targetCell);
            }
        }
    }
}

function selectAllText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

// 'Add Row' 기능
document.getElementById('insertRow').addEventListener('click', function() {
    if (getCurrentRowIndex() !== null) {
        const newRow = {
            index: getCurrentRowIndex() + 1,
            control_name: '',
            address: '',
            data: '',
            linked: 0,
            linked_vectorset: { file_name: '', latest: 0, vectorset_name: '' }
        };
        getVectorData().splice(getCurrentRowIndex(), 0, newRow);
        getVectorData().forEach((row, index) => row.index = index); // 인덱스 업데이트
        populateVectorTable(vectorTable, getVectorData());
    }
    contextMenu.style.display = 'none';
});

// 'Delete Row' 기능
document.getElementById('deleteRow').addEventListener('click', function() {
    if (getCurrentRowIndex() !== null) {
        getVectorData().splice(getCurrentRowIndex(), 1);
        getVectorData().forEach((row, index) => row.index = index); // 인덱스 업데이트
        populateVectorTable(vectorTable, getVectorData());
    }
    contextMenu.style.display = 'none';
});

// 'Switch Latest' 기능
document.getElementById('switchLatest').addEventListener('click', function() {
    if (getCurrentRowIndex() !== null && getVectorData()[getCurrentRowIndex()].linked === 1) {
        getVectorData()[getCurrentRowIndex()].linked_vectorset.latest = 
            getVectorData()[getCurrentRowIndex()].linked_vectorset.latest === 1 ? 0 : 1;
        populateVectorTable(vectorTable, getVectorData());
    }
    contextMenu.style.display = 'none';
});

// 클릭 시 context menu 숨기기
document.addEventListener('click', function(event) {
    if (!contextMenu.contains(event.target)) {
        contextMenu.style.display = 'none';
    }
});