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
    const clipboardPasteModal = new bootstrap.Modal(document.getElementById('clipboardPasteModal'));
    const clipboardTable = document.getElementById('clipboardTable');
    let currentFileName = '';
    let vectorData = [];
    let hierarchyData = {};
    let groupedItemsMap = {};
    let targetRowIndex = null; // Ctrl+V 할 때 선택된 행의 인덱스

    // 초기 로딩 시 프로젝트 목록 로드
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
        if (!vectorData || vectorData.length === 0) {
            alert('NO DATA TO SAVE');
            return;
        }

        if (currentFileName) {
            uploadVectorFile(currentFileName);
        } else {
            alert('No file loaded.');
        }
    });

    saveAsBtn.addEventListener('click', function() {
        if (!vectorData || vectorData.length === 0) {
            alert('NO DATA TO SAVE');
            return;
        }

        populateSelect(saveAsProject, Object.keys(hierarchyData));
        saveAsVectorset.value = '';
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

    function uploadVectorFile(fileName) {
        const payload = {
            user_id: document.getElementById('userID').value,
            file_name: fileName,
            vectors: { items: vectorData },
            project_name: projectSelect.value,
            evt_version: evtVersionSelect.value,
            domain_name: domainSelect.value,
            vectorset_name: vectorDetails.textContent.split(' > ').pop()
        };

        fetch('/api/v1/va/upload-vector-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (result.message) {
                alert('Save successful.');
            } else {
                alert('Error saving file: ' + result.error);
            }
        })
        .catch(error => console.error('Error uploading vector file:', error));
    }

    function populateVectorTable(table, items) {
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
                vectorsetCell.textContent = item.linked_vectorset.vectorset_name;
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

    // VectorTable에서 행 클릭 이벤트 감지
    vectorTable.addEventListener('click', function (event) {
        const row = event.target.closest('tr');
        if (row) {
            targetRowIndex = row.rowIndex - 1; // 선택된 행의 인덱스 저장
        }
    });

    // Ctrl+V 이벤트 감지
    document.addEventListener('paste', function (event) {
        if (targetRowIndex !== null) { // 특정 행이 선택되었을 때만 작동
            event.preventDefault();

            // 클립보드 데이터 가져오기
            const clipboardData = event.clipboardData.getData('text/plain');
            const rows = clipboardData.split('\n').filter(row => row.trim() !== ''); // 행으로 분리
            const tableData = rows.map(row => row.split('\t')); // 열을 탭으로 분리

            // 테이블 클리어
            clipboardTable.innerHTML = '';

            // 클립보드 데이터 테이블에 표시
            tableData.forEach(rowData => {
                const row = document.createElement('tr');
                rowData.forEach(cellData => {
                    const cell = document.createElement('td');
                    cell.textContent = cellData;
                    row.appendChild(cell);
                });
                clipboardTable.appendChild(row);
            });

            // 팝업 다이얼로그 표시
            clipboardPasteModal.show();
        }
    });

    // Paste 버튼 클릭 시 데이터를 VectorTable에 추가 (선택된 행 뒤에 추가)
    document.getElementById('pasteConfirmBtn').addEventListener('click', function () {
        const clipboardRows = Array.from(clipboardTable.getElementsByTagName('tr')); // 유사 배열을 배열로 변환

        // 새로 삽입된 데이터 인덱스를 기준으로 선택된 위치에서 데이터 삽입
        clipboardRows.forEach((clipboardRow, index) => {
            const newRow = vectorTable.insertRow(targetRowIndex + index + 1); // 선택된 행 뒤에 삽입

            // 새 인덱스는 선택된 행보다 하나 큰 값으로 설정
            const indexCell = newRow.insertCell(0);
            indexCell.textContent = targetRowIndex + index + 1; // 인덱스를 재설정

            const vectorsetCell = newRow.insertCell(1);
            vectorsetCell.textContent = ''; // 빈 값 (Vectorset)

            Array.from(clipboardRow.getElementsByTagName('td')).forEach((clipboardCell, cellIndex) => {
                const newCell = newRow.insertCell(cellIndex + 2); // 세 번째 셀부터 데이터 삽입
                newCell.textContent = clipboardCell.textContent;
            });
        });

        // 새로 삽입된 행 뒤의 모든 행의 인덱스 업데이트
        updateIndicesFrom(targetRowIndex + clipboardRows.length + 1);

        clipboardPasteModal.hide(); // 팝업 닫기
    });

    // 인덱스 업데이트 함수
    function updateIndicesFrom(startIndex) {
        for (let i = startIndex; i < vectorTable.rows.length; i++) {
            const row = vectorTable.rows[i];
            const indexCell = row.cells[0];
            indexCell.textContent = i; // 인덱스를 0부터 재배열
        }
    }
});
