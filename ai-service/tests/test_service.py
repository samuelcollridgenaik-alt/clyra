import os
os.environ['AI_SHARED_SECRET']='safe-test-only-secret-not-used-production'
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
headers={'X-AI-Service-Key':'safe-test-only-secret-not-used-production'}
payload={'title':'Water leaking in classroom','description':'Rainwater is dripping from the ceiling'}
def test_health_reports_model_state():
    response=client.get('/ai/health');assert response.status_code==200
    assert response.json()['service']=='clyra-ai'
def test_requires_service_auth():
    assert client.post('/ai/analyze',json=payload).status_code==503
    assert client.post('/ai/analyze',json=payload,headers={'X-AI-Service-Key':'wrong'}).status_code==401
def test_untrained_model_never_fabricates_category():
    r=client.post('/ai/analyze',json=payload,headers=headers)
    assert r.status_code==200
    assert r.json()['status'] in ['MODEL_UNAVAILABLE','READY']
    if r.json()['status']=='MODEL_UNAVAILABLE':assert r.json()['classification'] is None
def test_schema_rejects_short_text():
    assert client.post('/ai/analyze',json={'title':'x','description':'short'},headers=headers).status_code==422

def test_insights_are_deterministic_counts():
    r=client.post('/ai/insights',json={'categoryCounts':{'Electrical':3,'Plumbing':2}},headers=headers)
    assert r.status_code==200
    assert r.json()['total']==5 and r.json()['isForecast'] is False
