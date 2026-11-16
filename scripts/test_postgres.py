"""Run six real PostgreSQL tests in a new ephemeral container; never read project .env."""
import json,os,re,secrets,subprocess,time
from pathlib import Path
P=Path(__file__).resolve().parents[1]
R=P/'dist/lesson19';R.mkdir(parents=True,exist_ok=True)
name='inventory-lesson19-test-'+secrets.token_hex(5)
password=secrets.token_hex(18)
container=None
def docker(*args):
    return subprocess.run(['docker',*args],capture_output=True,text=True,check=True).stdout.strip()
try:
    container=docker('run','--detach','--rm','--name',name,'--label','course=lesson19-isolated-test',
        '-e','POSTGRES_DB=lesson19','-e','POSTGRES_PASSWORD='+password,
        '-p','127.0.0.1::5432','postgres:17-alpine')
    assert re.fullmatch(r'[a-f0-9]{64}',container)
    for _ in range(45):
        check=subprocess.run(['docker','exec',container,'pg_isready','-U','postgres','-d','lesson19'],capture_output=True)
        if check.returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('Isolated PostgreSQL did not become ready.')
    port=docker('port',container,'5432/tcp').removeprefix('127.0.0.1:')
    assert port.isdigit()
    environment=os.environ.copy()
    for key in list(environment):
        if key.startswith(('OPENAI_','INWORLD_','DATABASE_','DEMO_','LESSON19_')):del environment[key]
    environment.update(LESSON19_EPHEMERAL='1',
        LESSON19_TEST_DATABASE_URL=f'postgresql://postgres:{password}@127.0.0.1:{port}/lesson19',
        LESSON19_POSTGRES_RESULTS=str(R/'postgres-evidence.json'))
    result=subprocess.run(['node','--import','tsx','--test','--test-reporter=tap','tests/integration/postgres.test.ts'],
        cwd=P,env=environment,capture_output=True,text=True,encoding='utf-8')
    (R/'postgres-tests.tap').write_text(result.stdout,encoding='utf-8')
    if result.stderr:(R/'postgres-tests.stderr.txt').write_text(result.stderr.replace(password,'[redacted]'),encoding='utf-8')
    counts={k:int(re.search(r'^# '+k+r' (\d+)\s*$',result.stdout,re.M).group(1)) for k in ['tests','pass','fail']}
    report=dict(database='PostgreSQL 17',image='postgres:17-alpine',transport='node-postgres TCP loopback',
        passed=counts['pass'],failed=counts['fail'],tests=counts['tests'],ephemeral=True,
        userDatabaseTouched=False,environmentFilesLoaded=False,providerApiCalls=0,
        scope='Real local server grants, concurrent row/advisory locks, rollback and conditional decision/outbox SQL; no hosted auth, TLS, encryption service or worker claim.')
    (R/'postgres-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    assert result.returncode==0 and counts==dict(tests=6,**{'pass':6,'fail':0}),'PostgreSQL tests failed; inspect saved TAP.'
    print(json.dumps(report),flush=True)
finally:
    if container:
        docker('stop',container)
        (R/'postgres-cleanup.json').write_text(json.dumps(dict(ephemeralContainerRemoved=True)),encoding='utf-8')
