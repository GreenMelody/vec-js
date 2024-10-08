import os
import sys
import json
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from datetime import timezone, datetime

sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))
if 'log' not in sys.modules:
    from common import log

if 'bash' not in sys.modules:
    from common import bash

if 'db' not in sys.modules:
    from common import db

if 'github' not in sys.modules:
    from common import github

if 'restapi' not in sys.modules:
    from common import restapi

if 'excelToVectorJson' not in sys.modules:
    from converter import excelToVectorJson

json_info = open('etc/va_rest_api.conf').read()
va_rest_server_info = json.loads(json_info)
log_level = va_rest_server_info['LOG_LEVEL']
log = log.Log(os.path.basename(__file__)).set_custom_logger(log_level)

va_auth = (va_rest_server_info['USER'], va_rest_server_info['PASSWORD'])
va_host = va_rest_server_info['HOST']
va_port = va_rest_server_info['PORT']

# init restapi
restApi = restapi.RestAPI(log_level)
restApi.id = va_rest_server_info['USER']
restApi.pw = va_rest_server_info['PASSWORD']
restApi.header = {'Content-type':'application/json'}

# init github api
github = github.GitRestApi(log_level)
repo_url = github.github_info['VA_SCENARIO_REPO']
repo_branch = github.github_info['VA_SCENARIO_REPO_BRANCH']

db = db.DB(log_level)
db.db_name = va_rest_server_info['DB_NAME']

app = Flask(__name__)
CORS(app)

# 사용자 요청에서 user_id를 가져오도록 수정
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/v1/va/hierarchy', methods=['GET'])
def get_hierarchy():
    query = """
    SELECT p.project_name, e.evt_version, d.domain_name
    FROM project p
    JOIN evt e ON p.project_index = e.project_index
    JOIN domain d ON e.evt_index = d.evt_index
    """
    result = db.query(query)

    if isinstance(result, str) and result.startswith("FAIL"):
        return jsonify({"error": "Failed to query the database"}), 500

    hierarchy = {}
    for row in result:
        project = row['project_name']
        evt = row['evt_version']
        domain = row['domain_name']
        if project not in hierarchy:
            hierarchy[project] = {}
        if evt not in hierarchy[project]:
            hierarchy[project][evt] = []
        hierarchy[project][evt].append(domain)

    return jsonify({"items": hierarchy})

@app.route('/api/v1/va/vectorset-list', methods=['GET'])
def get_vectorset_list():
    project_name = request.args.get('project_name')
    evt_version = request.args.get('evt_version')
    domain_name = request.args.get('domain_name')

    query = f"""
    SELECT f.file_name, f.vectorset_name, f.modified, u.user_id AS owner
    FROM file f
    JOIN project p ON f.project_index = p.project_index
    JOIN evt e ON f.evt_index = e.evt_index
    JOIN domain d ON f.domain_index = d.domain_index
    JOIN user u ON f.owner = u.user_index
    WHERE p.project_name = '{project_name}' AND e.evt_version = '{evt_version}' AND d.domain_name = '{domain_name}'
    """
    result = db.query(query)

    if isinstance(result, str) and result.startswith("FAIL"):
        return jsonify({"error": "Failed to query the database"}), 500

    vectorsets = [
        {
            "file_name": file['file_name'],
            "project_name": project_name,
            "evt_version": evt_version,
            "domain_name": domain_name,
            "vector_name": file['vectorset_name'],
            "owner": file['owner'],
            "modified": file['modified'].replace(tzinfo=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        for file in result
    ]

    return jsonify({"items": vectorsets})

@app.route('/api/v1/va/vector-list', methods=['GET'])
def get_vector_list():
    file_name = request.args.get('file_name')

    # 파일 정보 DB에서 확인
    query = f"""
    SELECT file_path, repo_url, branch FROM file
    WHERE file_name = '{file_name}'
    """
    result = db.query(query)

    if not result or isinstance(result, str) and result.startswith("FAIL"):
        return jsonify({"error": "Failed to retrieve file information from the database"}), 500

    # GitHub에서 파일 가져오기
    file_info = result[0]
    status_code, response = github.get_repo_content(repo_url, branch=file_info['branch'], file_path=file_info['file_path'])

    if status_code != 200:
        return jsonify({"error": f"Failed to retrieve file from GitHub: {response}"}), 500

    try:
        vector_data = json.loads(response['content'])  # GitHub에서 받은 내용을 JSON으로 변환
        return jsonify({"items": vector_data['items']})
    except Exception as e:
        log.error(f"Error parsing GitHub file content: {e}")
        return jsonify({"error": "Failed to parse vector data"}), 500

if __name__ == '__main__':
    app.run(debug=True, host=va_host, port=va_port)
