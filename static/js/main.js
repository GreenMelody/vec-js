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
    const contextMenu = document.getElementById('contextMenu');
    const commentBtn = document.getElementById('commentBtn');
    const commentModal = new bootstrap.Modal(document.getElementById('commentModal'));
    const commentText = document.getElementById('commentText');
    const dropArea1 = document.getElementById('dropArea1');
    const dropArea2 = document.getElementById('dropArea2');
    const compareBtn = document.getElementById('compareBtn');
    const compareModal = new bootstrap.Modal(document.getElementById('compareModal'));
    const compareContainer = document.querySelector('.compare-container');
    let vectorSet1 = null;
    let vectorSet2 = null;
    let currentFileName = '';
    let vectorData = [];
    let hierarchyData = {};
    let targetRowIndex = null; // Ctrl+V 할 때 선택된 행의 인덱스
    let draggedRow = null;
    let isPasteModalOpen = false;
    let isInitialLoad = true;   //첫 로딩 체크
    let selectedRow = null; // 선택된 행을 저장
    let currentRowIndex = null; // 우클릭한 행의 인덱스를 저장
    let currentComment = ''; // 현재 로드 된 vector의 comment

    vectorTable.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        const row = event.target.closest('tr');
        if (row) {
            currentRowIndex = row.rowIndex - 1; // 행 인덱스 저장
            const linked = vectorData[currentRowIndex].linked;
            document.getElementById('switchLatest').style.display = linked === 1 ? 'block' : 'none';

            // 위치 설정 및 표시
            contextMenu.style.left = `${event.pageX}px`;
            contextMenu.style.top = `${event.pageY}px`;
            contextMenu.style.display = 'block';
        }
    });

    // 'Add Row' 기능
    document.getElementById('insertRow').addEventListener('click', function() {
        if (currentRowIndex !== null) {
            const newRow = {
                index: currentRowIndex + 1,
                control_name: '',
                address: '',
                data: '',
                linked: 0,
                linked_vectorset: { file_name: '', latest: 0, vectorset_name: '' }
            };
            vectorData.splice(currentRowIndex, 0, newRow);
            vectorData.forEach((row, index) => row.index = index); // 인덱스 업데이트
            populateVectorTable(vectorTable, vectorData);
        }
        contextMenu.style.display = 'none';
    });

    // 'Delete Row' 기능
    document.getElementById('deleteRow').addEventListener('click', function() {
        if (currentRowIndex !== null) {
            vectorData.splice(currentRowIndex, 1);
            vectorData.forEach((row, index) => row.index = index); // 인덱스 업데이트
            populateVectorTable(vectorTable, vectorData);
        }
        contextMenu.style.display = 'none';
    });

    // 'Switch Latest' 기능
    document.getElementById('switchLatest').addEventListener('click', function() {
        if (currentRowIndex !== null && vectorData[currentRowIndex].linked === 1) {
            vectorData[currentRowIndex].linked_vectorset.latest = 
                vectorData[currentRowIndex].linked_vectorset.latest === 1 ? 0 : 1;
            populateVectorTable(vectorTable, vectorData);
        }
        contextMenu.style.display = 'none';
    });

    // 클릭 시 context menu 숨기기
    document.addEventListener('click', function(event) {
        if (!contextMenu.contains(event.target)) {
            contextMenu.style.display = 'none';
        }
    });

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

    commentBtn.addEventListener('click', function() {
        const vectorsetName = vectorDetails.textContent.split(' > ').pop();
        if (!vectorsetName) {
            alert('No vectorset selected.');
            return;
        }
    
        // API 호출
        fetch(`/api/v1/va/vectorset-history?vectorset_name=${encodeURIComponent(vectorsetName)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(`Error fetching history: ${data.error}`);
                    return;
                }
    
                // 히스토리를 테이블로 표시
                const historyTableBody = document.getElementById('commentHistoryTableBody');
                historyTableBody.innerHTML = ''; // 기존 내용 초기화
    
                data.history.forEach(record => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${record.vectorset_name}</td>
                        <td>${record.owner}</td>
                        <td>${formatDate(record.modified)}</td>
                        <td>${record.comment || 'No comment'}</td>
                    `;
                    historyTableBody.appendChild(row);
                    // 현재 파일 이름과 비교하여 강조 표시
                    if (record.file_name === currentFileName) {
                        row.classList.add('current-version');
                    }
                });
                commentModal.show();
            })
            .catch(error => console.error('Error fetching vectorset history:', error));
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
                currentComment = data.comment;
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

    vectorTable.addEventListener('drop', async function (event) {
        event.preventDefault();
    
        const source = event.dataTransfer.getData('drag-source');
        if (source === 'external') {
            const data = JSON.parse(event.dataTransfer.getData('vectorset-data'));
            const fileName = data.fileName;
            const latest = data.latest || 0; // latest 값 포함
    
            // 무한 루프 검사
            const hasCycle = await checkCyclicDependency(fileName, latest);
            if (hasCycle) {
                alert(`Cannot add vectorset "${fileName}" due to a cyclic dependency.`);
                return;
            }
    
            // 마우스 커서가 위치한 행을 감지
            const targetRow = event.target.closest('tr');
            const targetIndex = targetRow ? targetRow.rowIndex - 1 : vectorData.length; // targetRow가 없으면 마지막에 추가
    
            const newRow = {
                index: targetIndex,
                control_name: '',
                address: '',
                data: '',
                linked: 1,
                linked_vectorset: {
                    file_name: fileName,
                    latest: latest,
                    vectorset_name: data.vectorsetName
                }
            };
    
            // vectorData 배열의 targetIndex 위치에 새 행 추가
            vectorData.splice(targetIndex, 0, newRow);
    
            // 삽입된 이후 행의 인덱스 값을 업데이트
            for (let i = targetIndex + 1; i < vectorData.length; i++) {
                vectorData[i].index = i;
            }
    
            // vectorData를 다시 렌더링
            populateVectorTable(vectorTable, vectorData);
        }
    });

    // 사이클 감지 함수
    async function checkCyclicDependency(newFileName, isLatest = 0) {
        const visited = new Set(); // 방문한 파일 추적
        const stack = new Set();   // 현재 탐색 중인 파일 추적
    
        // DFS로 참조 경로를 탐색
        async function dfs(fileName, latest) {
            const key = `${fileName}-${latest}`; // latest 값 포함한 고유 키
            if (stack.has(key)) {
                // 이미 탐색 중인 파일이 다시 나타나면 사이클 존재
                return true;
            }
            if (visited.has(key)) {
                // 이미 탐색 완료된 파일은 다시 탐색하지 않음
                return false;
            }
    
            visited.add(key);
            stack.add(key);
    
            try {
                // API 호출 시 latest 값을 포함하여 참조 데이터를 가져옴
                const response = await fetch(`/api/v1/va/vector-list?file_name=${fileName}&latest=${latest}`);
                const result = await response.json();
                const items = result.items || [];
    
                for (const item of items) {
                    if (item.linked && item.linked_vectorset?.file_name) {
                        const linkedFileName = item.linked_vectorset.file_name;
                        const linkedLatest = item.linked_vectorset.latest;
    
                        if (await dfs(linkedFileName, linkedLatest)) {
                            return true;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error checking cyclic dependency for file: ${fileName}`, error);
            }
    
            stack.delete(key);
            return false;
        }
    
        return await dfs(newFileName, isLatest);
    }

    // vectorTable에서 외부 드래그 허용
    vectorTable.addEventListener('dragover', function(event) {
        event.preventDefault();
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
    function addDragAndDropHandlers(row) {
        const dragHandle = document.createElement('td');
        dragHandle.innerHTML = '&#x2630;'; // 드래그 핸들 모양
        dragHandle.classList.add('drag-handle');
        row.appendChild(dragHandle);

        dragHandle.setAttribute('draggable', true);
        dragHandle.addEventListener('dragstart', function(event) {
            draggedRow = row;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('drag-source', 'internal'); // 드래그 시작 시 소스 설정
            row.classList.add('dragging');
        });

        dragHandle.addEventListener('dragend', function() {
            draggedRow.classList.remove('dragging');
            draggedRow = null;
            updateVectorDataOrder();  // 드래그 앤 드롭 후 vectorData 업데이트
            populateVectorTable(vectorTable, vectorData); // 테이블을 다시 렌더링하여 업데이트된 순서 반영
        });

        dragHandle.addEventListener('dragover', function(event) {
            event.preventDefault();
            const draggingRow = vectorTable.querySelector('.dragging');
            if (draggingRow) {
                const targetRow = event.target.closest('tr');
                if (targetRow && targetRow !== draggedRow) {
                    const bounding = targetRow.getBoundingClientRect();
                    const offset = bounding.y + bounding.height / 2;
                    if (event.clientY - offset > 0) {
                        targetRow.parentNode.insertBefore(draggingRow, targetRow.nextSibling);
                    } else {
                        targetRow.parentNode.insertBefore(draggingRow, targetRow);
                    }
                }
            }
        });

        // Drop 이벤트에서 초기화 처리
        dragHandle.addEventListener('drop', function() {
            updateRowIndices();
        });

        // dragenter와 dragleave 이벤트를 사용하여 조건부 스타일링
        row.addEventListener('dragenter', function(event) {
            const source = event.dataTransfer.getData('drag-source');
            if (source === 'internal') {
                row.classList.add('drag-over'); // 드래그 오버 시 스타일 추가
            }
        });

        row.addEventListener('dragleave', function(event) {
            row.classList.remove('drag-over'); // 드래그 오버 해제 시 스타일 제거
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

    function addDragAndDropToVectorsetList(row, item) {
        row.setAttribute('draggable', true);
        row.addEventListener('dragstart', function(event) {
            const selectedElement = row.querySelector('select'); //Date Modified select index
            const selectedIndex = selectedElement.value;
            const data = JSON.stringify({
                fileName: item.fileNames[selectedIndex],
                vectorsetName: item.vector_name
            });
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('drag-source', 'external');
            event.dataTransfer.setData('vectorset-data', data);
            row.classList.add('dragging');
        });

        row.addEventListener('dragend', function() {
            row.classList.remove('dragging');
        });
    }

    function populateVectorsetListTable() {
        vectorsetList.forEach(item => {
            const row = document.createElement('tr');
            // 필요한 셀 생성 및 추가
            addDragAndDropToVectorsetList(row, item);
            vectorSetTable.appendChild(row);
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
    copyTableBtn.addEventListener('click', async function () {
        const rows = Array.from(vectorTable.querySelectorAll('tr'));
        let clipboardContent = '';
    
        // 이미 처리된 vectorset 참조를 추적
        const processedFiles = new Set();
    
        // 재귀적으로 vectorset 데이터를 가져오는 함수
        async function fetchVectorsetData(fileName, latest, depth = 0, maxDepth = 3) {
            if (depth > maxDepth) {
                console.warn(`Maximum depth reached for file: ${fileName}`);
                return [];
            }
    
            if (processedFiles.has(fileName)) {
                console.warn(`Skipping already processed file: ${fileName}`);
                return [];
            }
    
            processedFiles.add(fileName);
    
            try {
                const response = await fetch(`/api/v1/va/vector-list?file_name=${fileName}&latest=${latest ? '1' : '0'}`);
                const result = await response.json();
    
                if (!result.items) return [];
    
                let allData = [];
    
                for (const item of result.items) {
                    if (item.linked && item.linked_vectorset?.file_name) {
                        // 참조된 vectorset 데이터를 재귀적으로 가져옴
                        const linkedData = await fetchVectorsetData(
                            item.linked_vectorset.file_name,
                            item.linked_vectorset.latest,
                            depth + 1,
                            maxDepth
                        );
                        allData = allData.concat(linkedData);
                    } else if (item.address && item.data) {
                        // 참조된 데이터가 아닌 경우 Address와 Data만 추가
                        allData.push({
                            address: item.address,
                            data: item.data,
                        });
                    }
                }
    
                return allData;
            } catch (error) {
                console.error(`Error fetching vectorset data for file: ${fileName}`, error);
                return [];
            }
        }
    
        // 테이블의 각 행 데이터 처리
        for (const row of rows) {
            const vectorsetCell = row.cells[1]; // Vectorset 열
            const addressCell = row.cells[3];  // Address 열
            const dataCell = row.cells[4];     // Data 열
    
            // Vectorset에 참조된 데이터가 있는 경우 처리
            if (vectorsetCell && vectorsetCell.textContent.trim()) {
                const fileName = vectorsetCell.getAttribute('data-file-name');
                const latest = vectorsetCell.getAttribute('data-latest') === '1';
    
                if (fileName) {
                    const vectorsetData = await fetchVectorsetData(fileName, latest);
                    vectorsetData.forEach(refItem => {
                        clipboardContent += `${refItem.address}\t${refItem.data}\n`;
                    });
                }
            } else {
                // Vectorset 참조가 없는 경우 현재 행의 Address와 Data를 복사
                const address = addressCell.textContent.trim();
                const data = dataCell.textContent.trim();
                clipboardContent += `${address}\t${data}\n`;
            }
        }
    
        // 클립보드에 복사
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(clipboardContent).then(() => {
                alert('Address와 Data가 클립보드에 복사되었습니다.');
            }).catch(err => {
                console.error('클립보드 복사 중 오류 발생:', err);
                fallbackCopyToClipboard(clipboardContent);
            });
        } else {
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


    // 드래그 앤 드롭 이벤트 처리 compare
    [dropArea1, dropArea2].forEach((dropArea, index) => {
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.backgroundColor = '#e9ecef';
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.style.backgroundColor = '';
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.backgroundColor = '';
            const data = JSON.parse(e.dataTransfer.getData('vectorset-data'));
            const fileName = data.fileName;

            // 데이터 저장 및 표시
            if (index === 0) vectorSet1 = fileName;
            if (index === 1) vectorSet2 = fileName;
            dropArea.querySelector('span').textContent = fileName;

            // Compare 버튼 활성화
            if (vectorSet1 && vectorSet2) compareBtn.disabled = false;
        });
    });

    // Compare 버튼 클릭
    compareBtn.addEventListener('click', async () => {
        if (!vectorSet1 || !vectorSet2) return;

        const [data1, data2] = await Promise.all([
            fetchVectorData(vectorSet1),
            fetchVectorData(vectorSet2),
        ]);

        populateCompareTables(data1, data2);
        compareModal.show();
    });

    // Vector 데이터 가져오기
    async function fetchVectorData(fileName) {
        const response = await fetch(`/api/v1/va/vector-list?file_name=${fileName}`);
        const data = await response.json();
        return data.items;
    }

    // 비교 결과 테이블 표시
    function populateCompareTables(data1, data2) {
        const tableLeft = document.getElementById('compareTableLeft');
        const tableRight = document.getElementById('compareTableRight');
        const leftFileName = document.getElementById('leftFileName');
        const rightFileName = document.getElementById('rightFileName');

        // 파일 이름 설정
        leftFileName.textContent = vectorSet1;
        rightFileName.textContent = vectorSet2;

        tableLeft.innerHTML = '';
        tableRight.innerHTML = '';

        const maxLength = Math.max(data1.length, data2.length);

        for (let i = 0; i < maxLength; i++) {
            const rowLeft = document.createElement('tr');
            const rowRight = document.createElement('tr');

            const item1 = data1[i] || {};
            const item2 = data2[i] || {};

            // `vectorset` 데이터 추출 및 latest에 따른 아이콘 추가
            const vectorset1 = item1.linked
                ? `${item1.linked_vectorset.latest === 1 ? '🔗' : '📌'}${item1.linked_vectorset.vectorset_name}`
                : '';
            const vectorset2 = item2.linked
                ? `${item2.linked_vectorset.latest === 1 ? '🔗' : '📌'}${item2.linked_vectorset.vectorset_name}`
                : '';
    
            // 하이라이트 비교 함수
            function compareValues(value1, value2) {
                return value1 !== value2 ? 'table-warning' : '';
            }

            // 좌측 테이블
            rowLeft.innerHTML = `
                <td>${i}</td>
                <td class="${compareValues(vectorset1, vectorset2)}">${vectorset1}</td>
                <td class="${compareValues(item1.control_name, item2.control_name)}">${item1.control_name || ''}</td>
                <td class="${compareValues(item1.address, item2.address)}">${item1.address || ''}</td>
                <td class="${compareValues(item1.data, item2.data)}">${item1.data || ''}</td>
            `;

            // 우측 테이블
            rowRight.innerHTML = `
                <td>${i}</td>
                <td class="${compareValues(vectorset1, vectorset2)}">${vectorset2}</td>
                <td class="${compareValues(item1.control_name, item2.control_name)}">${item2.control_name || ''}</td>
                <td class="${compareValues(item1.address, item2.address)}">${item2.address || ''}</td>
                <td class="${compareValues(item1.data, item2.data)}">${item2.data || ''}</td>
            `;

            tableLeft.appendChild(rowLeft);
            tableRight.appendChild(rowRight);
        }

        // 행 높이를 동일하게 설정
        equalizeRowHeights();
    }

    // 행 높이 맞추기
    function equalizeRowHeights() {
        const leftRows = document.querySelectorAll('#compareTableLeft tr');
        const rightRows = document.querySelectorAll('#compareTableRight tr');

        for (let i = 0; i < Math.max(leftRows.length, rightRows.length); i++) {
            const leftRow = leftRows[i];
            const rightRow = rightRows[i];

            if (leftRow && rightRow) {
                const maxHeight = Math.max(leftRow.offsetHeight, rightRow.offsetHeight);
                leftRow.style.height = `${maxHeight}px`;
                rightRow.style.height = `${maxHeight}px`;
            }
        }
    }


});
