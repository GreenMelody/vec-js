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

    // 초기 로딩 시 프로젝트 목록 로드
    fetch('/api/v1/va/hierarchy')
        .then(response => response.json())
        .then(data => {
            hierarchyData = data.items;
            populateSelect(projectSelect, Object.keys(hierarchyData));
            updateEvtVersions();
        })
        .catch(error => console.error('Error fetching hierarchy:', error));

    // 프로젝트 변경 시 evt 버전 업데이트
    projectSelect.addEventListener('change', function() {
        updateEvtVersions();
    });

    // evt 버전 변경 시 도메인 업데이트
    evtVersionSelect.addEventListener('change', function() {
        updateDomains();
    });

    // 도메인 변경 시 벡터셋 목록 업데이트
    domainSelect.addEventListener('change', function() {
        updateVectorsetList();
    });

    // 새로고침 버튼 클릭 시 벡터셋 목록 새로고침
    refreshBtn.addEventListener('click', function() {
        updateVectorsetList();
    });

    // evt 버전 업데이트 함수
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

    // 도메인 업데이트 함수
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

    // 벡터셋 목록 업데이트 함수
    function updateVectorsetList() {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        const domain = domainSelect.value;

        if (project && evtVersion && domain) {
            fetch(`/api/v1/va/vectorset-list?project_name=${project}&evt_version=${evtVersion}&domain_name=${domain}`)
                .then(response => response.json())
                .then(data => {
                    populateTable(vectorSetTable, data.items, ['vector_name', 'owner', 'modified']);
                })
                .catch(error => console.error('Error fetching vectorset list:', error));
        }
    }

    // 테이블에 데이터 채우는 함수 (날짜 포맷팅 포함)
    function populateTable(table, items, columns) {
        table.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('tr');
            columns.forEach(column => {
                const cell = document.createElement('td');
                
                // modified 컬럼에 대해 날짜 형식 변경
                if (column === 'modified') {
                    const formattedDate = formatDate(item[column]);
                    cell.textContent = formattedDate;
                } else {
                    cell.textContent = item[column];
                }

                row.appendChild(cell);
            });
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

    // 벡터셋 테이블 검색 기능
    document.getElementById('searchVectorset').addEventListener('input', function() {
        filterTable('searchVectorset', 'vectorsetList');
    });

    // 벡터 테이블 검색 기능
    document.getElementById('searchVector').addEventListener('input', function() {
        filterTable('searchVector', 'vectorList');
    });

    // 테이블 필터링 함수
    function filterTable(searchId, tableId) {
        const query = document.getElementById(searchId).value.toLowerCase();
        const rows = document.getElementById(tableId).getElementsByTagName('tr');
        Array.from(rows).forEach(row => {
            const rowText = row.innerText.toLowerCase();
            row.style.display = rowText.includes(query) ? '' : 'none';
        });
    }

    // 파일 업로드 이벤트 핸들링
    document.getElementById('fileUpload').addEventListener('change', function() {
        const fileInput = this;
        const file = fileInput.files[0];
        const userId = document.getElementById('userID').value;

        if (file && userId) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('user_id', userId);

            fetch('/api/v1/va/upload-file', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                alert('File uploaded successfully');
            })
            .catch(error => {
                console.error('Error uploading file:', error);
            });
        } else {
            alert('Please select a file and enter your user ID');
        }
    });
});
