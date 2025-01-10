import { updateVectorsetList, projectSelect, domainSelect, evtVersionSelect, vectorDetails, vectorTable, fileNameDisplay } from "./init.js";
import { getCurrentFileName, getHierarchyData, getVectorData, getVectorSet1, getVectorSet2 } from "./dataStore.js";
import { openVectorTableInNewWindow, commitMessageModal, compareModal, commentModal, saveAsModal } from "./modals.js";
import { populateSelect, formatDate } from "./tableUtils.js";
import { fetchVectorData, populateCompareTables } from "./compare.js";

export function setupButtons() {
    const saveBtn = document.getElementById('saveBtn');
    const commitSaveBtn = document.getElementById('commitSaveBtn');
    const saveAsBtn = document.getElementById('saveAsBtn');
    const commentBtn = document.getElementById('commentBtn');
    const saveAsProject = document.getElementById('saveAsProject');
    const saveAsEvt = document.getElementById('saveAsEvt');
    const saveAsDomain = document.getElementById('saveAsDomain');
    const compareBtn = document.getElementById('compareBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    logoutBtn.addEventListener('click', function() {
        fetch('/logout', { method: 'POST'})
            .then(response => {
                if (response.ok) {
                    window.location.href = '/login';
                } else{
                    alert('Logout failed');
                }
            })
            .catch(error => console.error('Logout error:', error));
    })

    refreshBtn.addEventListener('click', function() {
        updateVectorsetList();
    });

    // Compare 버튼 클릭
    compareBtn.addEventListener('click', async () => {
        if (!getVectorSet1() || !getVectorSet2()) return;

        const [data1, data2] = await Promise.all([
            fetchVectorData(getVectorSet1()),
            fetchVectorData(getVectorSet2()),
        ]);

        populateCompareTables(data1, data2);
        compareModal.show();
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

    saveBtn.addEventListener('click', function() {
        if (!getVectorData() || getVectorData().length === 0) {
            alert('NO DATA TO SAVE');
            return;
        }

        if (getCurrentFileName()) {
            document.getElementById('commitMessageText').value='';
            commitMessageModal.show();
        } else {
            alert('No file loaded.');
        }
    });

    commitSaveBtn.addEventListener('click', function() {
        const commitMessage = commitMessageText.value.trim();
        if (!commitMessage) {
            alert('Please enter a commit message.');
            return;
        }
        commitMessageModal.hide();
        uploadVectorFile(getCurrentFileName(), commitMessage);
    });

    // Save As 버튼 클릭 이벤트 수정
    saveAsBtn.addEventListener('click', function() {
        if (!getVectorData() || getVectorData().length === 0) {
            alert('NO DATA TO SAVE');
            return;
        }

        // 현재 선택된 project, evt version, domain, vectorset 가져오기
        const selectedProject = projectSelect.value;
        const selectedEvtVersion = evtVersionSelect.value;
        const selectedDomain = domainSelect.value;
        const selectedVectorset = vectorDetails.textContent.split(' > ').pop();

        // 필드 초기화 및 현재 선택된 값 할당
        populateSelect(saveAsProject, Object.keys(getHierarchyData()));
        saveAsProject.value = selectedProject;

        // evt version과 domain을 populate하고 초기값으로 선택
        populateSelect(saveAsEvt, Object.keys(getHierarchyData()[selectedProject]));
        saveAsEvt.value = selectedEvtVersion;

        populateSelect(saveAsDomain, getHierarchyData()[selectedProject][selectedEvtVersion]);
        saveAsDomain.value = selectedDomain;

        saveAsVectorset.value = selectedVectorset || '';

        saveAsModal.show();
    });

    commentBtn.addEventListener('click', function() {
        const fileName = fileNameDisplay.textContent.trim();
        if (!fileName) {
            alert('No file loaded.');
            return;
        }

        // API 호출
        fetch(`/api/v1/va/vectorset-history?file_name=${encodeURIComponent(fileName)}`)
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
                    if (record.file_name === fileName) {
                        row.classList.add('current-version');
                    }
                });
                commentModal.show();
            })
            .catch(error => console.error('Error fetching vectorset history:', error));
    });

    saveAsProject.addEventListener('change', function() {
        const project = saveAsProject.value;
        populateSelect(saveAsEvt, Object.keys(getHierarchyData()[project]));
        const evt = saveAsEvt.value;
        populateSelect(saveAsDomain, getHierarchyData()[project][evt]);
    });

    saveAsEvt.addEventListener('change', function() {
        const project = saveAsProject.value;
        const evt = saveAsEvt.value;
        populateSelect(saveAsDomain, getHierarchyData()[project][evt]);
    });

    saveAsConfirmBtn.addEventListener('click', function() {
        const newFileName = `${saveAsProject.value}_${saveAsEvt.value}_${saveAsDomain.value}_${saveAsVectorset.value}_.json`;
        const payload = {
            file_name: newFileName,
            vectors: { items: getVectorData() },
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
}

function uploadVectorFile(fileName, commitMessage) {
    const payload = {
        file_name: fileName,
        vectors: { items: getVectorData() },
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

// 새창열기 버튼 클릭 이벤트 추가
openInNewWindowBtn.addEventListener('click', function() {
    if (!getVectorData() || getVectorData().length === 0) {
        alert("Please select vector first.");
        return;
    }
    const fileName = fileNameDisplay.textContent;
    openVectorTableInNewWindow(fileName, 0);
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