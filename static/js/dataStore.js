/* vectorData */
let vectorData = [];
export function setVectorData(data){
    vectorData = data;
}
export function getVectorData(){
    return vectorData;
}

/* currentFileName */
let currentFileName = '';
export function setCurrentFileName(data){
    currentFileName = data;
}
export function getCurrentFileName(){
    return currentFileName;
}

/* hierarchyData */
let hierarchyData = {};
export function setHierarchyData(data){
    hierarchyData = data;
}
export function getHierarchyData(){
    return hierarchyData;
}

/* currentRowIndex */
let currentRowIndex = null;
export function setCurrentRowIndex(data){
    currentRowIndex = data;
}
export function getCurrentRowIndex(){
    return currentRowIndex;
}

/* selectedRow */
let selectedRow = null;
export function setSelectedRow(data){
    selectedRow = data;
}
export function getSelectedRow(){
    return selectedRow;
}

/* vectorSet1,2 for compare */
let vectorSet1 = null;
export function setVectorSet1(data){
    vectorSet1 = data;
}
export function getVectorSet1(){
    return vectorSet1;
}
let vectorSet2 = null;
export function setVectorSet2(data){
    vectorSet2 = data;
}
export function getVectorSet2(){
    return vectorSet2;
}