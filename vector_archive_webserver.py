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

app = Flask(__name__, static_folder="dist", template_folder="dist")
CORS(app)

user_id = 'test_owner'  # 실제로는 요청에서 user_id를 가져와야 합니다.

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

@app.route('/api/v1/va/vector-list', methods=['PUT'])
def update_vector_list():
    # 클라이언트로부터 받은 데이터를 사용하여 벡터 데이터를 업데이트하는 로직을 구현합니다.
    return jsonify({"result": "success"})

@app.route('/api/v1/va/upload-vector-file', methods=['POST'])
def upload_vector_file():
    data = request.get_json()
    user_id = data.get('user_id')
    file_name = data.get('file_name')
    vectors = data.get('vectors')
    project_name = data.get('project_name')
    evt_version = data.get('evt_version')
    domain_name = data.get('domain_name')
    vectorset_name = data.get('vectorset_name')

    # user_id가 user 테이블에 존재하는지 확인
    user_index = get_user_index(user_id)
    if not user_index:
        return jsonify({"error": f"User {user_id} does not exist"}), 403

    if not file_name or not vectors:
        return jsonify({"error": "File name or vectors data is missing"}), 400

    # 현재 시각을 기반으로 타임스탬프 생성
    current_time = datetime.now(timezone.utc)
    timestamp = current_time.strftime('%Y%m%dT%H%M%S%f')[:-3]

    # 새로운 파일 이름 생성
    parts = file_name.split('_')
    parts[-1] = f"{timestamp}.json"
    new_file_name = '_'.join(parts)

    # 파일 이름에서 생성한 타임스탬프를 기반으로 modified_time 설정
    modified_time = current_time.strftime('%Y-%m-%d %H:%M:%S')

    # GitHub에 파일 업로드
    commit_message = f"Upload vector file : {new_file_name}"
    content = json.dumps(vectors, indent=4)
    
    try:
        file_path = f"{project_name}/{evt_version}/{domain_name}/{new_file_name}"
        status_code, response = github.create_repo_content(
            repo_url, repo_branch, file_path=file_path, 
            commit_msg=commit_message, user=user_id, content=content
        )

        if status_code != 201:
            return jsonify({"error": f"Failed to upload to GitHub: {response}"}), 500

        # 데이터베이스에 파일 정보 저장
        project_index = get_or_create_project(project_name)
        evt_index = get_or_create_evt(evt_version, project_index)
        domain_index = get_or_create_domain(domain_name, evt_index)
        
        file_index = save_file_info(new_file_name, file_path, vectorset_name, modified_time, project_index, evt_index, domain_index, user_index, response)
        
        # 파일 권한 설정
        save_file_permission(file_index, user_index)

        # 새로운 파일 이름을 클라이언트로 반환
        return jsonify({"message": f"File {new_file_name} successfully uploaded and saved", "new_file_name": new_file_name}), 201

    except Exception as e:
        log.error(f"Error in upload_vector_file: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/va/upload-file', methods=['POST'])
def upload_file():
    user_id = request.args.get('user_id')
    # user_id가 user 테이블에 존재하는지 확인
    user_index = get_user_index(user_id)
    if not user_index:
        return jsonify({"error": f"User {user_id} does not exist"}), 403

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected for uploading"}), 400

    temp_dir = os.path.join(os.getcwd(), 'temp')

    try:
        # Temporary 디렉토리를 설정하고 파일 저장
        bash.make_dir(temp_dir)
        file_path = os.path.join(temp_dir, file.filename)
        file.save(file_path)
        
        # 엑셀 파일을 JSON 파일로 변환
        converter = excelToVectorJson.ExcelToJson(file_path, log_level)
        converter.main()
        
        # 변환된 JSON 파일 경로
        json_files = [os.path.join(converter.result_dir, f) for f in os.listdir(converter.result_dir) if f.endswith('.json')]
        
        if not json_files:
            return jsonify({"error": "Failed to convert Excel to JSON"}), 500

        # 엑셀 파일 경로 설정
        excel_github_path = f"{converter.project_name}/{converter.evt_version}/{converter.domain_name}/excel-file/{file.filename}"

        # GitHub에 엑셀 파일 존재 여부 확인
        status_code, _ = github.get_repo_content(repo_url, branch=repo_branch, file_path=excel_github_path)
        
        # 엑셀 파일이 GitHub에 존재하지 않을 때만 업로드
        if status_code == 404:  # 404 means the file does not exist
            commit_message = f"upload excel file : {file.filename}"

            with open(file_path, 'rb') as f:
                excel_content = f.read()

            github.create_repo_content(repo_url, repo_branch, excel_github_path, commit_message, user_id, excel_content, True)

        for json_file in json_files:
            # 파일명에서 필요한 정보 파싱
            json_file_name = os.path.basename(json_file)
            parts = json_file_name.split('_')
            
            if len(parts) < 4:
                return jsonify({"error": "Invalid file name format"}), 400
            
            project_name, evt_version, domain_name, *_ = parts
            vectorset_name = '_'.join(parts[3:-1])
            timestamp_str = parts[-1].split('.')[0]
            
            # 타임스탬프를 UTC로 변환하여 DATETIME 형식으로 변환
            modified_time = datetime.strptime(timestamp_str, '%Y%m%dT%H%M%S%f').strftime('%Y-%m-%d %H:%M:%S')
            
            # JSON 파일 경로 설정
            json_github_path = f"{project_name}/{evt_version}/{domain_name}/{json_file_name}"

            # GitHub에 JSON 파일 업로드
            commit_message = f"Initial commit from {file.filename}"
            with open(json_file, 'r') as f:
                json_content = f.read()
            status_code, response = github.create_repo_content(repo_url, repo_branch, json_github_path, commit_message, user_id, json_content)

            if status_code != 201:
                return jsonify({"error": f"Failed to upload JSON to GitHub: {response}"}), 500

            # Database 업데이트 (외래 키 관계를 고려)
            project_index = get_or_create_project(project_name)
            if not project_index:
                raise Exception("Failed to get or create project")
            
            evt_index = get_or_create_evt(evt_version, project_index)
            if not evt_index:
                raise Exception("Failed to get or create evt")
            
            domain_index = get_or_create_domain(domain_name, evt_index)
            if not domain_index:
                raise Exception("Failed to get or create domain")
            
            file_index = save_file_info(json_file_name, json_github_path, vectorset_name, modified_time, project_index, evt_index, domain_index, user_index, response)
            
            # file_permission 업데이트
            save_file_permission(file_index, user_index)

        return jsonify({"message": f"File {file.filename} successfully processed and uploaded"}), 201

    except Exception as e:
        log.error(f"Error in upload_file: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        # temp_dir 및 내부 파일들 삭제
        if os.path.exists(temp_dir):
            bash.delete_dir(temp_dir)

def get_user_index(user_id):
    result = db.get_idx_with_value('user', 'user_id', user_id)
    if isinstance(result, dict) and 'user_index' in result:
        return result['user_index']
    return None

def get_or_create_project(project_name):
    result = db.get_idx_with_value('project', 'project_name', project_name)
    if isinstance(result, dict) and 'project_index' in result:
        return result['project_index']
    elif result == "NO_DATA":
        sql = f"INSERT INTO project (project_name) VALUES ('{project_name}')"
        insert_result = db.query(sql)
        if insert_result.isdigit():
            return int(insert_result)
    return None

def get_or_create_evt(evt_version, project_index):
    result = db.query(f"SELECT evt_index FROM evt WHERE project_index = {project_index} AND evt_version = '{evt_version}'")
    if isinstance(result, list) and len(result) > 0 and 'evt_index' in result[0]:
        return result[0]['evt_index']
    elif not result or result == "NO_DATA":
        sql = f"INSERT INTO evt (project_index, evt_version) VALUES ({project_index}, '{evt_version}')"
        insert_result = db.query(sql)
        if insert_result.isdigit():
            return int(insert_result)
    return None

def get_or_create_domain(domain_name, evt_index):
    result = db.query(f"SELECT domain_index FROM domain WHERE evt_index = {evt_index} AND domain_name = '{domain_name}'")
    if isinstance(result, list) and len(result) > 0 and 'domain_index' in result[0]:
        return result[0]['domain_index']
    elif not result or result == "NO_DATA":
        sql = f"INSERT INTO domain (evt_index, domain_name) VALUES ({evt_index}, '{domain_name}')"
        insert_result = db.query(sql)
        if insert_result.isdigit():
            return int(insert_result)
    return None

def save_file_info(file_name, file_path, vectorset_name, modified_time, project_index, evt_index, domain_index, user_index, response):
    try:
        commit_id = response['commit']['sha']
        repo_url = response['commit']['url']
        sql = f"""
            INSERT INTO file (project_index, evt_index, domain_index, vectorset_name, file_name, file_path, branch, repo_url, commit_id, comment, modified, owner)
            VALUES ({project_index}, {evt_index}, {domain_index}, '{vectorset_name}', '{file_name}', '{file_path}', '{repo_branch}', '{repo_url}', '{commit_id}', 'Initial commit from {file_name}', '{modified_time}', {user_index})
        """
        file_index = db.query(sql)
        if file_index.isdigit():
            return int(file_index)
        else:
            raise Exception("Failed to insert file information")
    except Exception as e:
        log.error(f"Error in save_file_info: {e}")
        raise  # 예외를 다시 발생시켜 upload_file에서 처리하도록 합니다.

def save_file_permission(file_index, user_index):
    try:
        sql = f"INSERT INTO file_permission (file_index, user_index) VALUES ({file_index}, {user_index})"
        db.query(sql)
    except Exception as e:
        log.error(f"Error in save_file_permission: {e}")
        raise

if __name__ == '__main__':
    app.run(debug=True, host=va_host, port=va_port)
