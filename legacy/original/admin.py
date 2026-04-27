import os
import sqlite3
import pandas as pd
import io
from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, session, send_file
from werkzeug.utils import secure_filename
import qrcode

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # 운영 시 변경 필수

# 파일 업로드 설정
UPLOAD_FOLDER = os.path.join('static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 점검표 및 담당자 설정 (정렬 순서가 표시 순서가 됨)
CHECKLISTS = [
    {"key": "facility", "name": "시설관리실", "order": 1},
    {"key": "admin", "name": "행정실", "order": 2},
    {"key": "print", "name": "인쇄실", "order": 3},
]

RESPONSIBLE_PERSONS = {
    "facility": ["황정우", "백이선", "문관택"],
    "admin": ["김선미", "김희도", "고민제", "김정혜", "이민정"],
    "print": ["황정우", "백이선", "문관택"]
}

DUTY_OFFICERS = ["임재봉", "윤인현"]
ADMIN_PASSWORD = "1002"  # 운영 시 변경 필수

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def init_db():
    conn = sqlite3.connect('inspections.db')
    c = conn.cursor()
    for checklist in CHECKLISTS:
        c.execute(f'''CREATE TABLE IF NOT EXISTS inspections_{checklist["key"]} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            inspection_date TEXT NOT NULL,
            room TEXT,
            responsible_person TEXT,
            duty_officer TEXT,
            document TEXT, document_file TEXT,
            cleaning TEXT, cleaning_file TEXT,
            lighting TEXT, lighting_file TEXT,
            fire TEXT, fire_file TEXT,
            door TEXT, door_file TEXT,
            remarks TEXT,
            admin_verified INTEGER DEFAULT 0,
            admin_memo TEXT,
            verification_time TEXT
        )''')
    conn.commit()
    conn.close()

def save_files(request):
    files = {}
    for field in ['document_file', 'cleaning_file', 'lighting_file', 'fire_file', 'door_file']:
        file = request.files.get(field)
        if file and allowed_file(file.filename):
            filename = datetime.now().strftime("%Y%m%d_%H%M%S_") + secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            files[field] = filename
        else:
            files[field] = None
    return files

def get_latest_by_role(room, target_date=None):
    if target_date is None:
        target_date = datetime.now().strftime("%Y-%m-%d")
    
    date_start = f"{target_date} 00:00:00"
    date_end = f"{target_date} 23:59:59"
    
    conn = sqlite3.connect('inspections.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # 담당자 당일 최신 1개
    c.execute(f'''
        SELECT * FROM inspections_{room}
        WHERE responsible_person IS NOT NULL AND responsible_person != ''
        AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC LIMIT 1
    ''', (date_start, date_end))
    responsible = c.fetchone()
    
    # 당직자 당일 최신 1개
    c.execute(f'''
        SELECT * FROM inspections_{room}
        WHERE duty_officer IS NOT NULL AND duty_officer != ''
        AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC LIMIT 1
    ''', (date_start, date_end))
    duty = c.fetchone()
    
    conn.close()
    
    # 결과 배열
    result = []
    if responsible:
        result.append(responsible)
    if duty:
        result.append(duty)
    
    return result

@app.route('/')
def home():
    # 홈페이지는 관리자 로그인 후 접근 가능
    if 'admin_ok' not in session:
        return redirect(url_for('admin_login'))
    
    # 날짜 파라미터 가져오기
    target_date = request.args.get('date')
    
    # 기본값: 오늘
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")
    
    # 날짜 객체 생성
    current_date = datetime.strptime(target_date, "%Y-%m-%d")
    prev_date = (current_date - timedelta(days=1)).strftime("%Y-%m-%d")
    next_date = (current_date + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # 실별 당일 최신 점검(담당/당직자) 요약 - 실 순서대로 정렬
    room_summaries = []
    
    # 모든 실별로 데이터 가져오기
    for checklist in sorted(CHECKLISTS, key=lambda x: x['order']):
        latest = get_latest_by_role(checklist['key'], target_date)
        room_info = {
            "room_key": checklist['key'],
            "room_name": checklist['name'],
            "order": checklist['order'],
            "records": []
        }
        
        for row in latest:
            # 이상유무: 5개 항목 중 하나라도 '이상 유'나 '이상유'면 '이상 있음'
            abnormal = any(row[field] == '이상유' or row[field] == '이상 유'
                           for field in ['document', 'cleaning', 'lighting', 'fire', 'door'])
            room_info["records"].append({
                "id": row['id'],
                "timestamp": row['timestamp'],
                "person": row['responsible_person'] or row['duty_officer'],
                "role": "담당자" if row['responsible_person'] else "당직자",
                "abnormal": abnormal,
                "admin_verified": row['admin_verified'],
                "detail_url": url_for('detail', room=checklist['key'], record_id=row['id']),
                "verification_time": row['verification_time']
            })
        
        room_summaries.append(room_info)
    
    return render_template(
        'home.html', 
        room_summaries=room_summaries,
        current_date=current_date.strftime("%Y-%m-%d"),
        prev_date=prev_date,
        next_date=next_date,
        formatted_date=current_date.strftime("%Y년 %m월 %d일")
    )

@app.route('/submit/<room>', methods=['GET', 'POST'])
def submit(room):
    room_info = next((c for c in CHECKLISTS if c['key'] == room), None)
    if not room_info:
        return "존재하지 않는 점검표입니다.", 404

    form_data = session.pop('form_data', {}) if 'rewrite' in request.args else {}

    if request.method == 'POST':
        # 담당자/당직자 중 하나만 선택 가능
        responsible = request.form.get('responsible_person', '')
        duty = request.form.get('duty_officer', '')
        if not responsible and not duty:
            return "담당자 또는 당직자 중 하나를 선택해야 합니다.", 400
        
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        today = now.strftime("%Y-%m-%d")
        
        files = save_files(request)
        
        conn = sqlite3.connect('inspections.db')
        c = conn.cursor()
        
        # 당일 동일 역할의 이전 기록 삭제 (담당자 또는 당직자 별로)
        if responsible:
            c.execute(f'''
                DELETE FROM inspections_{room}
                WHERE responsible_person IS NOT NULL
                AND date(timestamp) = date(?)
            ''', (timestamp,))
        elif duty:
            c.execute(f'''
                DELETE FROM inspections_{room}
                WHERE duty_officer IS NOT NULL
                AND date(timestamp) = date(?)
            ''', (timestamp,))
        
        # 새 기록 삽입
        c.execute(f'''INSERT INTO inspections_{room} (
            timestamp, inspection_date, room, responsible_person, duty_officer,
            document, document_file, cleaning, cleaning_file,
            lighting, lighting_file, fire, fire_file,
            door, door_file, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (timestamp, today, room_info['name'], responsible, duty,
             request.form.get('document', '이상 무'), files.get('document_file'),
             request.form.get('cleaning', '이상 무'), files.get('cleaning_file'),
             request.form.get('lighting', '이상 무'), files.get('lighting_file'),
             request.form.get('fire', '이상 무'), files.get('fire_file'),
             request.form.get('door', '이상 무'), files.get('door_file'),
             request.form.get('remarks', ''))
        )
        
        conn.commit()
        
        # 생성된 레코드의 ID 가져오기
        record_id = c.lastrowid
        conn.close()
        
        # 변경: 제출 후 해당 실의 상세 페이지로 바로 이동
        return redirect(url_for('detail', room=room, record_id=record_id))
        
    return render_template(f'submit_{room}.html', 
                         room_name=room_info['name'], 
                         room_key=room_info['key'], 
                         responsible_persons=RESPONSIBLE_PERSONS[room],
                         duty_officers=DUTY_OFFICERS,
                         form_data=form_data)

@app.route('/detail/<room>/<int:record_id>')
def detail(room, record_id):
    room_info = next((c for c in CHECKLISTS if c['key'] == room), None)
    if not room_info:
        return "존재하지 않는 점검표입니다.", 404
    
    conn = sqlite3.connect('inspections.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(f'SELECT * FROM inspections_{room} WHERE id=?', (record_id,))
    record = c.fetchone()
    conn.close()
    
    if not record:
        return "기록이 없습니다.", 404
        
    return render_template('detail.html', 
                         room_name=room_info['name'],
                         room_key=room,
                         record=record,
                         record_id=record_id,
                         is_admin=('admin_ok' in session))

@app.route('/verify_record/<room>/<int:record_id>', methods=['POST'])
def verify_record(room, record_id):
    # 관리자 확인 로직 (관리자 로그인 필요)
    if 'admin_ok' not in session:
        return redirect(url_for('admin_login'))
        
    conn = sqlite3.connect('inspections.db')
    c = conn.cursor()
    
    # 관리자 메모와 확인 시간 저장
    admin_memo = request.form.get('admin_memo', '')
    verification_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    c.execute(f'''
        UPDATE inspections_{room}
        SET admin_verified = 1,
            admin_memo = ?,
            verification_time = ?
        WHERE id = ?
    ''', (admin_memo, verification_time, record_id))
    
    conn.commit()
    conn.close()
    
    # 이전 페이지로 리다이렉트 (detail 페이지나 홈으로)
    referrer = request.referrer
    if referrer and 'detail' in referrer:
        return redirect(url_for('detail', room=room, record_id=record_id))
    else:
        return redirect(url_for('home'))

@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    # 최초 1회만 비밀번호 입력
    if 'admin_ok' in session:
        return redirect(url_for('home'))
    
    error = None
    if request.method == 'POST':
        if request.form.get('pin') == ADMIN_PASSWORD:
            session['admin_ok'] = True
            return redirect(url_for('home'))
        else:
            error = "잘못된 비밀번호입니다."
    
    return render_template('admin_login.html', error=error)

@app.route('/admin/records')
def admin():
    if 'admin_ok' not in session:
        return redirect(url_for('admin_login'))
    
    # 날짜 필터 파라미터 가져오기
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    
    # 기본값 설정 (시작일: 일주일 전, 종료일: 오늘)
    if not start_date_str:
        start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    else:
        start_date = start_date_str
        
    if not end_date_str:
        end_date = datetime.now().strftime('%Y-%m-%d')
    else:
        end_date = end_date_str
    
    # 날짜 범위 조건 생성
    date_condition = ""
    if start_date and end_date:
        date_condition = f"WHERE inspection_date BETWEEN '{start_date}' AND '{end_date}'"
    
    # 실별 점검 기록 가져오기
    all_records = []
    conn = sqlite3.connect('inspections.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    for checklist in CHECKLISTS:
        # 날짜 필터 적용
        c.execute(f"""
            SELECT *, '{checklist['name']}' as room_display, '{checklist['key']}' as room_key, {checklist['order']} as room_order
            FROM inspections_{checklist['key']}
            {date_condition}
            ORDER BY timestamp DESC
        """)
        records = c.fetchall()
        
        for row in records:
            all_records.append({
                "room_key": checklist['key'],
                "room_name": checklist['name'],
                "room_order": checklist['order'],
                "id": row['id'],
                "timestamp": row['timestamp'],
                "inspection_date": row['inspection_date'],
                "person": row['responsible_person'] or row['duty_officer'],
                "role": "담당자" if row['responsible_person'] else "당직자",
                "abnormal": any(row[field] == '이상유' or row[field] == '이상 유'
                              for field in ['document', 'cleaning', 'lighting', 'fire', 'door']),
                "detail_url": url_for('detail', room=checklist['key'], record_id=row['id']),
                "admin_verified": row['admin_verified'],
                "verification_time": row['verification_time']
            })
    
    conn.close()
    
    # 실 순서로 정렬 후 각 실내에서 최신순 정렬
    all_records.sort(key=lambda x: (x['room_order'], -datetime.strptime(x['timestamp'], "%Y-%m-%d %H:%M:%S").timestamp()))
    
    return render_template('admin_records.html', 
                          summaries=all_records, 
                          start_date=start_date,
                          end_date=end_date)

@app.route('/admin/export_excel')
def export_excel():
    if 'admin_ok' not in session:
        return redirect(url_for('admin_login'))
    
    # 날짜 필터 가져오기
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    
    # 날짜 필터 조건 생성
    date_condition = ""
    if start_date and end_date:
        date_condition = f"WHERE inspection_date BETWEEN '{start_date}' AND '{end_date}'"
    
    # 모든 실의 점검 기록 가져오기
    conn = sqlite3.connect('inspections.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    all_records = []
    
    for checklist in CHECKLISTS:
        c.execute(f"""
            SELECT * FROM inspections_{checklist['key']} 
            {date_condition}
            ORDER BY timestamp DESC
        """)
        records = c.fetchall()
        for record in records:
            # 필요한 데이터만 추출
            all_records.append({
                '점검일시': record['timestamp'],
                '점검일자': record['inspection_date'],
                '실': checklist['name'],
                '담당자': record['responsible_person'] or '',
                '당직자': record['duty_officer'] or '',
                '점검자': record['responsible_person'] or record['duty_officer'],
                '역할': '담당자' if record['responsible_person'] else '당직자',
                '서류보관상태': record['document'],
                '청소상태': record['cleaning'],
                '소등상태': record['lighting'],
                '화기단속상태': record['fire'],
                '문단속상태': record['door'],
                '비고': record['remarks'] or '',
                '관리자확인': '확인완료' if record['admin_verified'] else '미확인',
                '확인일시': record['verification_time'] or '',
                # 이상 유무 판단
                '이상유무': not any(record[field] == '이상유' or record[field] == '이상 유'
                             for field in ['document', 'cleaning', 'lighting', 'fire', 'door'])
            })
    conn.close()
    
    # 엑셀 파일 생성
    output = io.BytesIO()
    
    # pandas ExcelWriter 사용 (xlsxwriter 엔진)
    writer = pd.ExcelWriter(output, engine='xlsxwriter')
    df = pd.DataFrame(all_records)
    
    # 엑셀 시트에 데이터 쓰기
    df.to_excel(writer, index=False, sheet_name='점검기록')
    
    # xlsxwriter 객체 가져오기
    workbook = writer.book
    worksheet = writer.sheets['점검기록']
    
    # 이상유무 컬럼에 동그라미 표시 포맷 설정
    circle_format = workbook.add_format({'font_color': 'green', 'bold': True, 'font_size': 14})
    
    # 열 너비 설정
    for i, col in enumerate(df.columns):
        column_width = max(df[col].astype(str).map(len).max(), len(col)) + 2
        worksheet.set_column(i, i, column_width)
    
    # 이상유무 컬럼 위치 가져오기 (마지막 컬럼)
    abnormal_col = len(df.columns) - 1
    
    # 각 행을 순회하며 이상유무에 따라 동그라미 표시
    for row_num, value in enumerate(df['이상유무'], start=1):
        if value:  # 이상 없음(True)일 때만 동그라미 표시
            worksheet.write(row_num, abnormal_col, '◯', circle_format)
        else:
            worksheet.write(row_num, abnormal_col, '', workbook.add_format({'font_color': 'red'}))
    
    writer.close()
    output.seek(0)
    
    # 현재 날짜로 파일명 생성
    today = datetime.now().strftime('%Y%m%d')
    filename = f'보안점검기록_{today}.xlsx'
    
    return send_file(
        output, 
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/logout')
def logout():
    session.pop('admin_ok', None)
    return redirect(url_for('admin_login'))

@app.route('/generate_qr')
def generate_qr():
    os.makedirs('static/qrcodes', exist_ok=True)
    base_url = "http://localhost:8080"  # 서버 주소 변경 필요
    for checklist in CHECKLISTS:
        qr = qrcode.QRCode(
            version=1,
            box_size=10,
            border=4
        )
        qr.add_data(f'{base_url}/submit/{checklist["key"]}')
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(os.path.join('static/qrcodes', f'{checklist["key"]}_qr.png'))
    return "QR 코드가 생성되었습니다."

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=8080, host='0.0.0.0')
