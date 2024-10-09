document.addEventListener('DOMContentLoaded', function() {
    const projectSelect = document.getElementById('projectName');
    const evtVersionSelect = document.getElementById('evtVersion');
    const domainSelect = document.getElementById('domainName');
    const vectorSetTable = document.getElementById('vectorsetList');
    const vectorTable = document.getElementById('vectorList');
    const vectorDetails = document.getElementById('vectorDetails'); 
    const fileNameDisplay = document.getElementById('fileName'); 
    const refreshBtn = document.getElementById('refreshBtn');
    const saveBtn = document.getElementById('saveBtn');
    const saveAsBtn = document.getElementById('saveAsBtn'); 

    const saveAsModal = new bootstrap.Modal(document.getElementById('saveAsModal'));
    const saveAsProject = document.getElementById('saveAsProject');
    const saveAsEvt = document.getElementById('saveAsEvt');
    const saveAsDomain = document.getElementById('saveAsDomain');
    const saveAsVectorset = document.getElementById('saveAsVectorset');
    const saveAsConfirmBtn = document.getElementById('saveAsConfirmBtn');

    let currentFileName = '';
    let vectorData = [];
    let hierarchyData = {};
    let groupedItemsMap = {};

    fetch('/api/v1/va/hierarchy')
        .then(response => response.json())
        .then(data => {
            hierarchyData = data.items;
            populateSelect(projectSelect, Object.keys(hierarchyData));
            updateEvtVersions();
        })
        .catch(error => console.error('Error fetching hierarchy:', error));

    projectSelect.addEventListener('change', function() {
        updateEvtVersions();
    });

    evtVersionSelect.addEventListener('change', function() {
        updateDomains();
    });

    domainSelect.addEventListener('change', function() {
        updateVectorsetList();
    });

    refreshBtn.addEventListener('click', function() {
        updateVectorsetList();
    });

    saveBtn.addEventListener('click', function() {
        if (currentFileName) {
            saveVectorData(currentFileName);
        } else {
            alert('No file loaded.');
        }
    });

    saveAsBtn.addEventListener('click', function() {
        populateSelect(saveAsProject, Object.keys(hierarchyData));
        saveAsVectorset.value = ''; // 초기화
        saveAsModal.show();
    });

    saveAsProject.addEventListener('change', function() {
        const project = saveAsProject.value;
        populateSelect(saveAsEvt, Object.keys(hierarchyData[project]));
    });

    saveAsEvt.addEventListener('change', function() {
        const project = saveAsProject.value;
        const evt = saveAsEvt.value;
        populateSelect(saveAsDomain, hierarchyData[project][evt]);
    });

    saveAsConfirmBtn.addEventListener('click', function() {
        const newFileName = `${saveAsVectorset.value}.json`;
        const payload = {
            user_id: document.getElementById('userID').value,
            file_name: newFileName,
            vectors: vectorData,
            project_name: saveAsProject.value,
            evt_version: saveAsEvt.value,
            domain_name: saveAsDomain.value,
            vectorset_name: saveAsVectorset.value
        };

        fetch('/api/v1/va/upload-vector-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (result.message) {
                alert('File saved successfully.');
                saveAsModal.hide();
            } else {
                alert('Error saving file: ' + result.error);
            }
        })
        .catch(error => console.error('Error uploading vector file:', error));
    });

    function updateEvtVersions() {
        const project = projectSelect.value;
        if (hierarchyData[project]) {
            populateSelect(evtVersionSelect, Object.keys(hierarchyData[project]));
            updateDomains();
        }
    }

    function updateDomains() {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        if (hierarchyData[project] && hierarchyData[project][evtVersion]) {
            populateSelect(domainSelect, hierarchyData[project][evtVersion]);
            updateVectorsetList();
        }
    }

    function updateVectorsetList() {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        const domain = domainSelect.value;

        if (project && evtVersion && domain) {
            fetch(`/api/v1/va/vectorset-list?project_name=${project}&evt_version=${evtVersion}&domain_name=${domain}`)
                .then(response => response.json())
                .then(data => {
                    populateTable(vectorSetTable, groupByVectorNameAndOwner(data.items));
                })
                .catch(error => console.error('Error fetching vectorset list:', error));
        }
    }

    function groupByVectorNameAndOwner(items) {
        const groupedItems = {};

        items.forEach(item => {
            const key = `${item.vector_name}_${item.owner}`;
            if (!groupedItems[key]) {
                groupedItems[key] = {
                    vector_name: item.vector_name,
                    owner: item.owner,
                    modified: [item.modified],
                    fileNames: [item.file_name] 
                };
            } else {
                groupedItems[key].modified.push(item.modified);
                groupedItems[key].fileNames.push(item.file_name);
            }
        });

        Object.values(groupedItems).forEach(group => {
            const combined = group.modified.map((date, index) => ({
                date,
                fileName: group.fileNames[index]
            }));
            combined.sort((a, b) => new Date(b.date) - new Date(a.date));
            group.modified = combined.map(item => item.date);
            group.fileNames = combined.map(item => item.fileName);
        });

        groupedItemsMap = groupedItems;
        return Object.values(groupedItems);
    }

    function populateTable(table, groupedItems) {
        table.innerHTML = '';
        groupedItems.forEach(item => {
            const row = document.createElement('tr');

            const vectorNameCell = document.createElement('td');
            vectorNameCell.textContent = item.vector_name;
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

            table.appendChild(row);
        });
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}.${month}.${day}. ${hours}:${minutes}:${seconds}`;
    }

    function loadVectorData(fileName) {
        fetch(`/api/v1/va/vector-list?file_name=${fileName}`)
            .then(response => response.json())
            .then(data => {
                vectorData = data.items;
                populateVectorTable(vectorTable, vectorData);
                currentFileName = fileName;
            })
            .catch(error => console.error('Error loading vector data:', error));
    }

    // 텍스트 전체 선택 함수
    function selectAllText(element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Vector 데이터를 벡터 테이블에 채우는 함수 (더블클릭 시 수정 가능)
    function populateVectorTable(table, items) {
        table.innerHTML = '';
        items.forEach((item, rowIndex) => {
            const row = document.createElement('tr');

            // Index
            const indexCell = document.createElement('td');
            indexCell.textContent = item.index;
            row.appendChild(indexCell);

            // Vectorset
            const vectorsetCell = document.createElement('td');
            vectorsetCell.textContent = item.linked_vectorset.vectorset_name || item.control_name;
            row.appendChild(vectorsetCell);

            // Control Name (더블클릭으로 수정 가능)
            const controlNameCell = document.createElement('td');
            controlNameCell.textContent = item.control_name;
            makeEditable(controlNameCell, item, 'control_name', rowIndex, 2);
            row.appendChild(controlNameCell);

            // Address (더블클릭으로 수정 가능)
            const addressCell = document.createElement('td');
            addressCell.textContent = item.address;
            makeEditable(addressCell, item, 'address', rowIndex, 3);
            row.appendChild(addressCell);

            // Data (더블클릭으로 수정 가능)
            const dataCell = document.createElement('td');
            dataCell.textContent = item.data;
            makeEditable(dataCell, item, 'data', rowIndex, 4);
            row.appendChild(dataCell);

            table.appendChild(row);
        });

        // 셀을 더블클릭해서 수정할 수 있게 만드는 함수
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
                    const isLastCell = (cellIndex === table.rows[rowIndex].cells.length - 1);
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
                        moveToCell(rowIndex - 1, table.rows[0].cells.length - 1);
                    } else {
                        moveToCell(rowIndex, cellIndex - 1);
                    }
                }
            });
        }

        // 특정 셀로 이동하여 수정 가능하게 설정하는 함수
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

    function saveVectorData(fileName) {
        const payload = {
            file_name: fileName,
            items: vectorData
        };

        fetch('/api/v1/va/save-vector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(response => response.json())
            .then(result => {
                alert('Save successful.');
            })
            .catch(error => console.error('Error saving vector data:', error));
    }

    function populateSelect(selectElement, items) {
        selectElement.innerHTML = '';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            selectElement.appendChild(option);
        });
    }

    document.getElementById('searchVectorset').addEventListener('input', function() {
        filterTable('searchVectorset', 'vectorsetList');
    });

    document.getElementById('searchVector').addEventListener('input', function() {
        filterTable('searchVector', 'vectorList');
    });

    function filterTable(searchId, tableId) {
        const query = document.getElementById(searchId).value.toLowerCase();
        const rows = document.getElementById(tableId).getElementsByTagName('tr');
        Array.from(rows).forEach(row => {
            const rowText = row.innerText.toLowerCase();
            row.style.display = rowText.includes(query) ? '' : 'none';
        });
    }
});
