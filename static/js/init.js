import { populateSelect, populateTable, populateVectorTable } from './tableUtils.js';
import { selectRowByIndex, checkCyclicDependency } from './dragAndDrop.js';
import { getVectorData, setHierarchyData, getHierarchyData, getCurrentRowIndex, setCurrentRowIndex, getSelectedRow } from "./dataStore.js";
import { clipboardPasteModal } from './modals.js';

export const projectSelect = document.getElementById('projectName');
export const evtVersionSelect = document.getElementById('evtVersion');
export const domainSelect = document.getElementById('domainName');
export const fileNameDisplay = document.getElementById('fileName');
export const vectorDetails = document.getElementById('vectorDetails');
export const vectorTable = document.getElementById('vectorList');
const vectorSetTable = document.getElementById('vectorsetList');
const searchVectorset = document.getElementById('searchVectorset');
const searchVector = document.getElementById('searchVector');

let isInitialLoad = true;
let isPasteModalOpen = false;
let targetRowIndex = null;

export default function init() {
    fetch('/api/v1/va/hierarchy')
        .then(response => response.json())
        .then(data => {
            setHierarchyData(data.items);
            populateSelect(projectSelect, Object.keys(getHierarchyData()));
            if (isInitialLoad && Object.keys(getHierarchyData()).length > 1) {
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

    searchVectorset.addEventListener('input', function() {
        filterTable('searchVectorset', 'vectorsetList');
    });

    searchVector.addEventListener('input', function() {
        filterTable('searchVector', 'vectorList');
    });

    vectorTable.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        const row = event.target.closest('tr');
        if (row) {
            setCurrentRowIndex(row.rowIndex - 1); // 행 인덱스 저장
            const linked = getVectorData()[getCurrentRowIndex()].linked;
            document.getElementById('switchLatest').style.display = linked === 1 ? 'block' : 'none';

            // 위치 설정 및 표시
            contextMenu.style.left = `${event.pageX}px`;
            contextMenu.style.top = `${event.pageY}px`;
            contextMenu.style.display = 'block';
        }
    });

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
            const targetIndex = targetRow ? targetRow.rowIndex - 1 : getVectorData().length; // targetRow가 없으면 마지막에 추가

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
            getVectorData().splice(targetIndex, 0, newRow);

            // 삽입된 이후 행의 인덱스 값을 업데이트
            for (let i = targetIndex + 1; i < getVectorData().length; i++) {
                getVectorData()[i].index = i;
            }

            // vectorData를 다시 렌더링
            populateVectorTable(vectorTable, getVectorData());
        }
    });

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
            if (getSelectedRow()) {
                getSelectedRow().classList.remove('selected-row');
                getSelectedRow() = null;
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

            getVectorData().splice(targetRowIndex + index + 1, 0, rowData); // vectorData 배열에 삽입
        });

        // 삽입된 이후의 인덱스 값을 모두 다시 계산
        for (let i = targetRowIndex + clipboardRows.length + 1; i < vectorData.length; i++) {
            getVectorData()[i].index = i;
        }

        // vectorData를 다시 렌더링
        populateVectorTable(vectorTable, getVectorData());

        clipboardPasteModal.hide(); // 팝업 닫기
    });

    // 붙여넣기 완료 후 상태 플래그 해제
    clipboardPasteModal._element.addEventListener('hidden.bs.modal', function () {
        targetRowIndex = null;
        isPasteModalOpen = false;
    });
}

function filterTable(searchId, tableId) {
    const query = document.getElementById(searchId).value.toLowerCase();
    const rows = document.getElementById(tableId).getElementsByTagName('tr');
    Array.from(rows).forEach(row => {
        const rowText = row.innerText.toLowerCase();
        row.style.display = rowText.includes(query) ? '' : 'none';
    });
}

function updateEvtVersions() {
    const project = projectSelect.value;
    if (getHierarchyData()[project]) {
        populateSelect(evtVersionSelect, Object.keys(getHierarchyData()[project]));
        if (isInitialLoad && Object.keys(getHierarchyData()[project]).length > 0) {
            evtVersionSelect.selectedIndex = 1;
        }
        updateDomains();
    }
}

function updateDomains() {
    const project = projectSelect.value;
    const evtVersion = evtVersionSelect.value;
    if (getHierarchyData()[project] && getHierarchyData()[project][evtVersion]) {
        populateSelect(domainSelect, getHierarchyData()[project][evtVersion]);
        if (isInitialLoad && Object.keys(getHierarchyData()[project][evtVersion]).length > 0) {
            domainSelect.selectedIndex = 3;
        }
        updateVectorsetList();
    }
}

export function updateVectorsetList() {
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