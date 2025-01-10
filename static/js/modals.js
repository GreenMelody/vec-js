export const commitMessageModal = new bootstrap.Modal(document.getElementById('commitMessageModal'));
export const compareModal = new bootstrap.Modal(document.getElementById('compareModal'));
export const commentModal = new bootstrap.Modal(document.getElementById('commentModal'));
export const saveAsModal = new bootstrap.Modal(document.getElementById('saveAsModal'));
export const clipboardPasteModal = new bootstrap.Modal(document.getElementById('clipboardPasteModal'));

export function openVectorTableInNewWindow(fileName, isLatest) {
    const newWindow = window.open(`/vector_table_view?file_name=${encodeURIComponent(fileName)}&latest=${isLatest}`, '_blank', 'width=800,height=600,left=200,top=100');
}