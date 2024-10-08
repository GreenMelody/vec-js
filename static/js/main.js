document.addEventListener('DOMContentLoaded', function() {
    const projectSelect = document.getElementById('projectName');
    const evtVersionSelect = document.getElementById('evtVersion');
    const domainSelect = document.getElementById('domainName');
    const vectorSetTable = document.getElementById('vectorsetList');
    const vectorTable = document.getElementById('vectorList');
    const vectorDetails = document.getElementById('vectorDetails');
    const fileNameDisplay = document.getElementById('fileName');

    // 초기 로딩 시 프로젝트 목록 로드
    fetch('/api/v1/va/hierarchy')
        .then(response => response.json())
        .then(data => {
            populateSelect(projectSelect, Object.keys(data.items));
            updateEvtVersions(data.items);  // 프로젝트 선택 후 evt 버전 업데이트
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

    // evt 버전 업데이트 함수
    function updateEvtVersions(items) {
        const project = projectSelect.value;
        if (items && items[project]) {
            const evtVersions = Object.keys(items[project]);
            populateSelect(evtVersionSelect, evtVersions);
            updateDomains(items);  // evt 버전 선택 후 도메인 업데이트
        }
    }

    // 도메인 업데이트 함수
    function updateDomains(items) {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        if (items && items[project] && items[project][evtVersion]) {
            const domains = items[project][evtVersion];
            populateSelect(domainSelect, domains);
            updateVectorsetList();  // 도메인 선택 후 벡터셋 업데이트
        }
    }

    // 벡터셋 목록 업데이트 함수
    function updateVectorsetList() {
        const project = projectSelect.value;
        const evtVersion = evtVersionSelect.value;
        const domain = domainSelect.value;

        fetch(`/api/v1/va/vectorset-list?project_name=${project}&evt_version=${evtVersion}&domain_name=${domain}`)
            .then(response => response.json())
            .then(data => {
                populateTable(vectorSetTable, data.items, ['vector_name', 'owner', 'modified']);
            })
            .catch(error => console.error('Error fetching vectorset list:', error));
    }

    // 테이블에 데이터 채우는 함수
    function populateTable(table, items, columns) {
        table.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('tr');
            columns.forEach(column => {
                const cell = document.createElement('td');
                cell.textContent = item[column];
                row.appendChild(cell);
            });
            table.appendChild(row);
        });
    }

    // select에 데이터 채우는 함수
    function populateSelect(selectElement, items) {
        selectElement.innerHTML = ''; // 기존 옵션 제거
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            selectElement.appendChild(option);
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
