$(document).ready(function() {
    function populateComboboxes(data) {
        let projects = Object.keys(data.items);
        let projectSelect = $("#projectName");
        projectSelect.empty();
        projects.forEach(function(project) {
            projectSelect.append(`<option value="${project}">${project}</option>`);
        });

        projectSelect.change(function() {
            let evtSelect = $("#evtVersion");
            let project = $(this).val();
            evtSelect.empty();
            Object.keys(data.items[project]).forEach(function(evt) {
                evtSelect.append(`<option value="${evt}">${evt}</option>`);
            });
            evtSelect.trigger("change");
        });

        $("#evtVersion").change(function() {
            let domainSelect = $("#domainName");
            let project = $("#projectName").val();
            let evt = $(this).val();
            domainSelect.empty();
            data.items[project][evt].forEach(function(domain) {
                domainSelect.append(`<option value="${domain}">${domain}</option>`);
            });
        });

        projectSelect.trigger("change");
    }

    // 첫 페이지 로드 시 GET 요청을 보내 combobox 리스트 설정
    $.get("/api/v1/va/hierarchy", function(data) {
        populateComboboxes(data);
    });

    $("#refreshBtn").click(function() {
        let project = $("#projectName").val();
        let evt = $("#evtVersion").val();
        let domain = $("#domainName").val();

        $.get(`/api/v1/va/vectorset-list?project_name=${project}&evt_version=${evt}&domain_name=${domain}`, function(data) {
            let vectorsetList = $("#vectorsetList");
            vectorsetList.empty();
            data.items.forEach(function(vectorset) {
                vectorsetList.append(`<tr><td>${vectorset.vector_name}</td><td>${vectorset.owner}</td><td>${vectorset.modified}</td></tr>`);
            });
        });
    });
});
