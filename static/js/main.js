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
    const openInNewWindowBtn = document.getElementById('openInNewWindowBtn');
    const copyTableBtn = document.getElementById('copyTableBtn');
    const commitMessageModal = new bootstrap.Modal(document.getElementById('commitMessageModal'));
    const commitMessageText = document.getElementById('commitMessageText');
    let currentFileName = '';
    let vectorData = [];
    let hierarchyData = {};
    let targetRowIndex = null; // Ctrl+V 할 때 선택된 행의 인덱스
    let draggedRow = null;
    let dragStartIndex = null; // 드래그 시작 인덱스를 저장
    let isPasteModalOpen = false;
    let isInitialLoad = true;   //첫 로딩 체크
    let selectedRow = null; // 선택된 행을 저장

    // 초기 로딩 시 프로젝트 목록 로드
    fetch('/api/v1/va/hierarchy')
        .then(response => response.json())
        .then(data => {
            hierarchyData = data.items;
            populateSelect(projectSelect, Object.keys(hierarchyData));
            if (isInitialLoad && Object.keys(hierarchyData).length > 1) {
                projectSelect.selectedIndex = 3;
            }
            updateEvtVersions();
            isInitialLoad = false;
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
            document.getElementById('commitMessageText').value='';
            commitMessageModal.show();
        } else {
            alert('No file loaded.');
        }
    });

    document.getElementById('commitSaveBtn').addEventListener('click', function() {
        const commitMessage = commitMessageText.value.trim();
        if (!commitMessage) {
            alert('Please enter a commit message.');
            return;
        }
        commitMessageModal.hide();
        uploadVectorFile(currentFileName, commitMessage);
    });

    // Save As 버튼 클릭 이벤트 수정
    saveAsBtn.addEventListener('click', function() {
        if (!vectorData || vectorData.length === 0) {
            alert('NO DATA TO SAVE');
            return;
        }
    
        // 현재 선택된 project, evt version, domain, vectorset 가져오기
        const selectedProject = projectSelect.value;
        const selectedEvtVersion = evtVersionSelect.value;
        const selectedDomain = domainSelect.value;
        const selectedVectorset = vectorDetails.textContent.split(' > ').pop();
    
        // 필드 초기화 및 현재 선택된 값 할당
        populateSelect(saveAsProject, Object.keys(hierarchyData));
        saveAsProject.value = selectedProject;
    
        // evt version과 domain을 populate하고 초기값으로 선택
        populateSelect(saveAsEvt, Object.keys(hierarchyData[selectedProject]));
        saveAsEvt.value = selectedEvtVersion;
    
        populateSelect(saveAsDomain, hierarchyData[selectedProject][selectedEvtVersion]);
        saveAsDomain.value = selectedDomain;
    
        saveAsVectorset.value = selectedVectorset || '';
    
        saveAsModal.show();
    });

    saveAsProject.addEventListener('change', function() {
        const project = saveAsProject.value;
        populateSelect(saveAsEvt, Object.keys(hierarchyData[project]));
        const evt = saveAsEvt.value;
        populateSelect(saveAsDomain, hierarchyData[project][evt]);
    });

    saveAsEvt.addEventListener('change', function() {
        const project = saveAsProject.value;
        const evt = saveAsEvt.value;
        populateSelect(saveAsDomain, hierarchyData[project][evt]);
    });

    saveAsConfirmBtn.addEventListener('click', function() {
        const newFileName = `${saveAsProject.value}_${saveAsEvt.value}_${saveAsDomain.value}_${saveAsVectorset.value}_.json`;
        const payload = {
            file_name: newFileName,
            vectors: {items: vectorData},
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
                updateVectorsetList();
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
            if (isInitialLoad && Object.keys(hierarchyData[project]).length > 0) {
                evtVersionSelect.selectedIndex = 1;
            }
            updateDomains();
        }
    }

    function updateDomains() {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        if (hierarchyData[project] && hierarchyData[project][evtVersion]) {
            populateSelect(domainSelect, hierarchyData[project][evtVersion]);
            if (isInitialLoad && Object.keys(hierarchyData[project][evtVersion]).length > 0) {
                domainSelect.selectedIndex = 3;
            }
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

        return Object.values(groupedItems);
    }

    function populateTable(table, groupedItems) {
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

            row.draggable = true;
            row.addEventListener('dragstart', (e) => {
                const selectedIndex = selectElement.value;
                const selectedFileName = item.fileNames[selectedIndex];
                const selectedVectorsetName = item.vector_name;
                const data = JSON.stringify({selectedFileName, selectedVectorsetName})
                e.dataTransfer.setData('text/plain', data);
                row.classList.add('dragging');
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
            });

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

    // 2024-10-10T13:24:58 => 2024.10.10. 13:24:58
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

    function uploadVectorFile(fileName, commitMessage) {
        const payload = {
            file_name: fileName,
            vectors: { items: vectorData },
            project_name: projectSelect.value,
            evt_version: evtVersionSelect.value,
            domain_name: domainSelect.value,
            vectorset_name: vectorDetails.textContent.split(' > ').pop(),
            commit_message: commitMessage
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
                updateVectorsetList();
            } else {
                alert('Error saving file: ' + result.error);
            }
        })
        .catch(error => console.error('Error uploading vector file:', error));
    }

    function openVectorTableInNewWindow(fileName, isLatest) {
        const newWindow = window.open(`/vector_table_view?file_name=${encodeURIComponent(fileName)}&latest=${isLatest}`, '_blank', 'width=800,height=600,left=200,top=100');
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

    // 선택된 행을 시각적으로 표시하는 함수
    function selectRowByIndex(index) {
        if (selectedRow) {
            selectedRow.classList.remove('selected-row');
        }

        if (index !== null && vectorTable.rows[index]) {
            selectedRow = vectorTable.rows[index];
            selectedRow.classList.add('selected-row');
        }
    }

    // VectorTable에서 행 클릭 이벤트 감지
    vectorTable.addEventListener('click', function (event) {
        const row = event.target.closest('tr');
        if (row) {
            targetRowIndex = row.rowIndex - 1; // 선택된 행의 인덱스 저장
            selectRowByIndex(targetRowIndex);
        }
    });

    vectorTable.addEventListener('dragover', function (event) {
        event.preventDefault();
        const targetRow = event.target.closest('tr');
        if (targetRow && targetRow !== draggedRow) {
            const bounding = targetRow.getBoundingClientRect();
            const offset = bounding.y + bounding.height / 2;
            if (event.clientY - offset > 0) {
                targetRow.classList.remove('drag-over-above');
                targetRow.classList.add('drag-over-below');
            } else {
                targetRow.classList.remove('drag-over-below');
                targetRow.classList.add('drag-over-above');
            }
        }
    });

    vectorTable.addEventListener('dragenter', function(event) {
        const targetRow = event.target.closest('tr');
        if (targetRow && targetRow !== draggedRow && !targetRow.classList.contains('drag-over')) {
            targetRow.classList.add('drag-over');
        }
    });
    
    vectorTable.addEventListener('dragleave', function(event) {
        const targetRow = event.target.closest('tr');
        if (targetRow) {
            targetRow.classList.remove('drag-over');
        }
    });
    
    vectorTable.addEventListener('drop', function (event) {
        event.preventDefault();
        const targetRow = event.target.closest('tr');
        if (targetRow) {
            const targetIndex = Array.from(vectorTable.rows).indexOf(targetRow); // 드롭 위치 인덱스
    
            // 드롭할 위치에 행을 이동
            if (draggedRow && targetIndex !== -1 && dragStartIndex !== null) {
                if (targetIndex < dragStartIndex) {
                    vectorTable.insertBefore(draggedRow, targetRow);
                } else {
                    vectorTable.insertBefore(draggedRow, targetRow.nextSibling);
                }
    
                // vectorData 배열 순서 업데이트
                const movedData = vectorData.splice(dragStartIndex, 1)[0];
                vectorData.splice(targetIndex, 0, movedData);
    
                // 인덱스 업데이트 및 테이블 다시 렌더링
                updateRowIndices();
                populateVectorTable(vectorTable, vectorData);
            }
    
            // 드래그 스타일 제거
            targetRow.classList.remove('drag-over-above', 'drag-over-below');
        }
    });

    // document의 다른 부분 클릭 시 targetRowIndex 초기화 (붙여넣기 팝업이 열리지 않았을 때만)
    document.addEventListener('click', function(event) {
        const isClickInsideTable = vectorTable.contains(event.target);

        // 테이블 외부를 클릭하고 붙여넣기 팝업이 열리지 않은 경우에만 targetRowIndex를 초기화
        if (!isClickInsideTable && !isPasteModalOpen) {
            targetRowIndex = null;
            if (selectedRow) {
                selectedRow.classList.remove('selected-row');
                selectedRow = null;
            }
        }
    }, true);

    // Ctrl+V 이벤트 감지
    document.addEventListener('paste', function (event) {
        isPasteModalOpen = true;
        if (targetRowIndex !== null) { // 특정 행이 선택되었을 때만 작동
            event.preventDefault();

            // 클립보드 데이터 가져오기
            const clipboardData = event.clipboardData.getData('text/plain');
            const rows = clipboardData.split('\n').filter(row => row.trim() !== ''); // 행으로 분리
            const tableData = rows.map(row => row.split('\t')); // 열을 탭으로 분리

            // 유효성 검사: 1열 이하일 경우 알람 표시
            if (tableData[0].length <= 1) {
                alert('붙여넣을 데이터를 확인하세요.');
                return;
            }

            // 테이블 클리어
            clipboardTable.innerHTML = '';

            // 테이블 헤더 설정
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');

            if (tableData[0].length >= 3) {
                headerRow.innerHTML = '<th>Control Name</th><th>Address</th><th>Data</th>';
            } else if (tableData[0].length === 2) {
                headerRow.innerHTML = '<th>Address</th><th>Data</th>';
            }
            thead.appendChild(headerRow);
            clipboardTable.appendChild(thead);

            // 클립보드 데이터 테이블에 표시 (3열까지만 표시)
            const tbody = document.createElement('tbody');
            tableData.forEach(rowData => {
                const row = document.createElement('tr');
                rowData.slice(0, 3).forEach((cellData, index) => {
                    const cell = document.createElement('td');
                    cell.textContent = cellData;
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            });
            clipboardTable.appendChild(tbody);

            // 팝업 다이얼로그 표시
            clipboardPasteModal.show();
        }
    });

    // Paste 버튼 클릭 시 데이터를 vectorData에 추가하고 테이블 다시 렌더링
    document.getElementById('pasteConfirmBtn').addEventListener('click', function () {
        const clipboardRows = Array.from(clipboardTable.getElementsByTagName('tbody')[0].getElementsByTagName('tr')); // tbody의 데이터만 가져옴

        // 클립보드 데이터를 선택된 인덱스 위치에 삽입
        clipboardRows.forEach((clipboardRow, index) => {
            const cellCount = clipboardRow.cells.length; // 각 행의 셀 수 확인

            let rowData = {
                index: targetRowIndex + index + 1, // 삽입되는 인덱스는 선택된 행 이후
                linked: 0, // 기본값 설정
                linked_vectorset: { file_name: '', latest: 0, vectorset_name: '' }, // 기본값 설정
                control_name: '', // 기본적으로 빈값 설정
                address: '',
                data: ''
            };

            // 셀이 2개인 경우 Control Name을 비우고 Address와 Data만 설정
            if (cellCount === 2) {
                rowData.address = clipboardRow.cells[0].textContent || ''; // 첫 번째 셀을 Address로 사용
                rowData.data = clipboardRow.cells[1].textContent || '';    // 두 번째 셀을 Data로 사용
            }
            // 셀이 3개인 경우 Control Name, Address, Data 모두 설정
            else if (cellCount === 3) {
                rowData.control_name = clipboardRow.cells[0].textContent || ''; // 첫 번째 셀 (control_name)
                rowData.address = clipboardRow.cells[1].textContent || '';      // 두 번째 셀 (address)
                rowData.data = clipboardRow.cells[2].textContent || '';         // 세 번째 셀 (data)
            }

            vectorData.splice(targetRowIndex + index + 1, 0, rowData); // vectorData 배열에 삽입
        });

        // 삽입된 이후의 인덱스 값을 모두 다시 계산
        for (let i = targetRowIndex + clipboardRows.length + 1; i < vectorData.length; i++) {
            vectorData[i].index = i;
        }

        // vectorData를 다시 렌더링
        populateVectorTable(vectorTable, vectorData);

        clipboardPasteModal.hide(); // 팝업 닫기
    });

    // 붙여넣기 완료 후 상태 플래그 해제
    clipboardPasteModal._element.addEventListener('hidden.bs.modal', function () {
        targetRowIndex = null;
        isPasteModalOpen = false;
    });

    // 각 테이블 행에 드래그 앤 드롭 관련 이벤트 추가
    function addDragAndDropHandlers(row, index) {
        const dragHandle = document.createElement('td');
        dragHandle.innerHTML = '&#x2630;'; // 드래그 핸들 모양
        dragHandle.classList.add('drag-handle');
        row.appendChild(dragHandle);
    
        row.draggable = true;
    
        row.addEventListener('dragstart', function (event) {
            draggedRow = row;
            dragStartIndex = index; // 드래그 시작 인덱스 저장
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', 'internal_drag');
            row.classList.add('dragging');
        });
    
        row.addEventListener('dragend', function () {
            row.classList.remove('dragging');
            draggedRow = null;
            dragStartIndex = null; // 드래그 시작 인덱스 초기화
        });
    }

    // 테이블의 행 순서 변경 후 인덱스 업데이트
    function updateRowIndices() {
        const rows = vectorTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
            row.cells[0].textContent = index;
            vectorData[index].index = index;
        });
    }

    // vectorData 업데이트 함수: 테이블의 순서를 반영하여 vectorData를 재정렬
    function updateVectorDataOrder() {
        const rows = vectorTable.querySelectorAll('tr');
        const newVectorData = [];

        rows.forEach((row, index) => {
            const vectorsetName = row.cells[1].textContent.replace(/^🔗|📌/,'');
            const controlName = row.cells[2].textContent;
            const address = row.cells[3].textContent;
            const data = row.cells[4].textContent;

            const linked = vectorsetName ? 1 : 0;
            const fileName = row.cells[1].getAttribute('data-file-name') || '';
            const latest = parseInt(row.cells[1].getAttribute('data-latest')) || 0;

            // 새 vectorData 배열에 현재 행의 데이터를 업데이트
            newVectorData.push({
                index: index,
                control_name: controlName,
                address: address,
                data: data,
                linked: linked,
                linked_vectorset: {
                    file_name: fileName,
                    latest: latest,
                    vectorset_name: vectorsetName
                }
            });
        });

        // vectorData를 새로운 배열로 교체
        vectorData = newVectorData;
    }

    // 새창열기 버튼 클릭 이벤트 추가
    openInNewWindowBtn.addEventListener('click', function() {
        if (!vectorData || vectorData.length === 0) {
            alert("Please select vector first.");
            return;
        }
        const fileName = fileNameDisplay.textContent;
        openVectorTableInNewWindow(fileName, 0);
    });

    // 복사하기 버튼 클릭 이벤트 추가
    copyTableBtn.addEventListener('click', function() {
        const rows = Array.from(vectorTable.querySelectorAll('tr'));
        let clipboardContent = '';

        rows.forEach(row => {
            const address = row.cells[3].textContent.trim();  // Address 열
            const data = row.cells[4].textContent.trim();     // Data 열
            clipboardContent += `${address}\t${data}\n`;      // 탭으로 구분
        });

        // 클립보드에 복사
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(clipboardContent).then(() => {
                alert('Address와 Data가 클립보드에 복사되었습니다.');
            }).catch(err => {
                console.error('클립보드 복사 중 오류 발생:', err);
                fallbackCopyToClipboard(clipboardContent);
            });
        } else {
            // Fallback 방법 실행
            fallbackCopyToClipboard(clipboardContent);
        }
    });

    // Fallback 복사 함수
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // 사용자에게 보이지 않게 함
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            alert('Address와 Data가 클립보드에 복사되었습니다.');
        } catch (err) {
            console.error('Fallback 복사 중 오류 발생:', err);
        }

        document.body.removeChild(textArea);
    }

    document.getElementById('logoutBtn').addEventListener('click', function() {
        fetch('/logout', { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    window.location.href = '/login';
                } else {
                    alert('Logout failed.');
                }
            })
            .catch(error => console.error('Logout error:', error));
    });
});
