import { getVectorSet1, getVectorSet2 } from "./dataStore.js";

// Vector 데이터 가져오기
export async function fetchVectorData(fileName) {
    const response = await fetch(`/api/v1/va/vector-list?file_name=${fileName}`);
    const data = await response.json();
    return data.items;
}

// 비교 결과 테이블 표시
export function populateCompareTables(data1, data2) {
    const tableLeft = document.getElementById('compareTableLeft');
    const tableRight = document.getElementById('compareTableRight');
    const leftFileName = document.getElementById('leftFileName');
    const rightFileName = document.getElementById('rightFileName');

    // 파일 이름 설정
    leftFileName.textContent = getVectorSet1();
    rightFileName.textContent = getVectorSet2();

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