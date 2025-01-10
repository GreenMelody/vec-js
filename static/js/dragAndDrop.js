import { populateVectorTable } from "./tableUtils.js";
import { vectorTable } from "./init.js";
import { setVectorData, getVectorData, getSelectedRow, setSelectedRow } from "./dataStore.js";
import { getVectorSet1, setVectorSet1, getVectorSet2, setVectorSet2 } from "./dataStore.js";

export const dropArea1 = document.getElementById('dropArea1');
export const dropArea2 = document.getElementById('dropArea2');

let draggedRow = null;

export function addDragAndDropToVectorsetList(row, item) {
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

// 각 테이블 행에 드래그 앤 드롭 관련 이벤트 추가
export function addDragAndDropHandlers(row) {
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

// 선택된 행을 시각적으로 표시하는 함수
export function selectRowByIndex(index) {
    if (selectedRow) {
        selectedRow.classList.remove('selected-row');
    }

    if (index !== null && vectorTable.rows[index]) {
        selectedRow = vectorTable.rows[index];
        selectedRow.classList.add('selected-row');
    }
}

// 사이클 감지 함수
export async function checkCyclicDependency(newFileName, isLatest = 0) {
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