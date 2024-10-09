document.addEventListener('DOMContentLoaded', function() {
    const projectSelect = document.getElementById('projectName');
    const evtVersionSelect = document.getElementById('evtVersion');
    const domainSelect = document.getElementById('domainName');
    const vectorSetTable = document.getElementById('vectorsetList');
    const vectorTable = document.getElementById('vectorList');
    const vectorDetails = document.getElementById('vectorDetails');
    const fileNameDisplay = document.getElementById('fileName');
    const refreshBtn = document.getElementById('refreshBtn');

    let hierarchyData = {};
    let groupedItemsMap = {}; // 그룹화된 items을 저장하는 map

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

    function updateEvtVersions() {
        const project = projectSelect.value;
        if (hierarchyData[project]) {
            const evtVersions = Object.keys(hierarchyData[project]);
            populateSelect(evtVersionSelect, evtVersions);
            updateDomains();
        } else {
            evtVersionSelect.innerHTML = '';
            domainSelect.innerHTML = '';
        }
    }

    function updateDomains() {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        if (hierarchyData[project] && hierarchyData[project][evtVersion]) {
            const domains = hierarchyData[project][evtVersion];
            populateSelect(domainSelect, domains);
            updateVectorsetList();
        } else {
            domainSelect.innerHTML = '';
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

    // 벡터셋 데이터를 vector_name과 owner별로 그룹화하는 함수
    function groupByVectorNameAndOwner(items) {
        const groupedItems = {};

        items.forEach(item => {
            const key = `${item.vector_name}_${item.owner}`;
            if (!groupedItems[key]) {
                groupedItems[key] = {
                    vector_name: item.vector_name,
                    owner: item.owner,
                    modified: [item.modified],
                    fileNames: [item.file_name] // file_name 저장
                };
            } else {
                groupedItems[key].modified.push(item.modified);
                groupedItems[key].fileNames.push(item.file_name); // 동일한 그룹에 해당하는 file_name 추가
            }
        });

        // modified와 fileNames 배열을 함께 정렬
        Object.values(groupedItems).forEach(group => {
            const combined = group.modified.map((date, index) => ({
                date,
                fileName: group.fileNames[index]
            }));

            combined.sort((a, b) => new Date(b.date) - new Date(a.date)); // 날짜 기준으로 내림차순 정렬

            group.modified = combined.map(item => item.date); // 정렬된 modified
            group.fileNames = combined.map(item => item.fileName); // 정렬된 fileNames
        });

        groupedItemsMap = groupedItems; // 그룹화된 items 저장
        return Object.values(groupedItems);
    }

    // 벡터셋 테이블에 데이터 채우는 함수 + LOAD 버튼 추가
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
                option.value = index; // 각 날짜의 index로 value를 설정
                option.textContent = formatDate(dateString);
                selectElement.appendChild(option);
            });
            modifiedCell.appendChild(selectElement);
            row.appendChild(modifiedCell);

            // LOAD 버튼 추가
            const loadButtonCell = document.createElement('td');
            const loadButton = document.createElement('button');
            loadButton.textContent = 'LOAD';
            loadButton.classList.add('btn', 'btn-primary', 'btn-sm');
            loadButton.addEventListener('click', function() {
                const selectedIndex = selectElement.value; // 선택된 index 가져오기
                const selectedFileName = item.fileNames[selectedIndex]; // index를 통해 file_name 참조
                loadVectorData(selectedFileName);
            });
            loadButtonCell.appendChild(loadButton);
            row.appendChild(loadButtonCell);

            table.appendChild(row);
        });
    }

    // 날짜를 'YYYY.MM.DD. HH:MM:SS' 형식으로 변환하는 함수
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

    // Vectorset 데이터를 로드하는 함수 (file_name을 사용하여 요청)
    function loadVectorData(fileName) {
        fetch(`/api/v1/va/vector-list?file_name=${fileName}`)
            .then(response => response.json())
            .then(data => {
                populateTable(vectorTable, data.items);
            })
            .catch(error => console.error('Error loading vector data:', error));
    }

    // select에 데이터 채우는 함수
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
