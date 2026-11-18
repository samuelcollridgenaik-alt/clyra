"""Private Clyra AI inference service. No fake predictions or accuracy claims."""
from __future__ import annotations
import datetime as dt
import os
from pathlib import Path
from typing import Any
import joblib
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field

app = FastAPI(title='Clyra Private AI Service', version='0.1.0', docs_url=None, redoc_url=None)
ROOT = Path(os.getenv('AI_MODEL_DIR', Path(__file__).resolve().parents[1] / 'artifacts'))
MODELS: dict[str, Any] = {}

def authenticate(x_ai_service_key: str | None = Header(default=None)):
    secret = os.getenv('AI_SHARED_SECRET', '')
    if not secret or secret.startswith('replace-with') or not x_ai_service_key:
        raise HTTPException(status_code=503, detail='Service identity not configured')
    import secrets
    if not secrets.compare_digest(secret, x_ai_service_key):
        raise HTTPException(status_code=401, detail='Unauthorized')

class ComplaintInput(BaseModel):
    title: str = Field(min_length=5,max_length=160)
    description: str = Field(min_length=10,max_length=5000)
    locationId: str | None = None
    category: str | None = None
    candidates: list[dict[str, Any]] = Field(default_factory=list, max_length=250)

class InsightsInput(BaseModel):
    startDate: str | None = None
    endDate: str | None = None
    categoryCounts: dict[str,int] = Field(default_factory=dict)

def load(name: str):
    """Trusted, local administrator-approved sklearn model only. Never download remote artifacts implicitly."""
    if name in MODELS:
        return MODELS[name]
    path=ROOT / f'{name}.joblib'
    if not path.exists():
        return None
    model=joblib.load(path)
    MODELS[name]=model
    return model

def predict(name: str, text: str):
    model=load(name)
    if model is None:
        return None
    label=str(model.predict([text])[0])
    # Probabilities omitted: uncalibrated classifier probability is not calibrated confidence.
    return {'category' if name=='category' else 'level':label,'confidence':None}

def duplicate_candidates(payload: ComplaintInput):
    if not payload.candidates:
        return []
    try:
        from sentence_transformers import SentenceTransformer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        raise HTTPException(status_code=503, detail='Sentence Transformers not installed')
    # Deliberately explicit: the model is downloaded only after external config/network are approved.
    model_name=os.getenv('AI_DUPLICATE_MODEL','sentence-transformers/all-MiniLM-L6-v2')
    try:
        model = MODELS.get('embedding')
        if model is None:
            model=SentenceTransformer(model_name,local_files_only=True)
            MODELS['embedding']=model
    except Exception:
        raise HTTPException(status_code=503, detail='Embedding model not locally available')
    query=payload.title+' '+payload.description
    texts=[query]+[str(c.get('title',''))+' '+str(c.get('description','')) for c in payload.candidates]
    vectors=model.encode(texts)
    scores=cosine_similarity(vectors[0:1], vectors[1:]).ravel()
    ranked=sorted(zip(payload.candidates,scores),key=lambda x:float(x[1]),reverse=True)
    return [{'complaintId':c.get('complaintId'),'similarity':float(score),'sameLocation':str(c.get('locationId'))==str(payload.locationId)} for c,score in ranked[:5]]

def analyze(payload: ComplaintInput):
    text=payload.title+' '+payload.description
    cat=predict('category',text)
    pri=predict('priority',text)
    return {'classification':cat,'priority':pri,'duplicates':[], 'modelVersion': 'category-baseline-v1' if cat else 'unavailable','status':'READY' if cat else 'MODEL_UNAVAILABLE','analyzedAt':dt.datetime.now(dt.timezone.utc).isoformat()}

@app.get('/ai/health')
def health():
    return {'status':'ok','service':'clyra-ai','modelAvailable':(ROOT/'category.joblib').exists()}

@app.get('/ai/model-info',dependencies=[Depends(authenticate)])
def model_info():
    return {'categoryModel':(ROOT/'category.joblib').exists(),'priorityModel':(ROOT/'priority.joblib').exists(),'modelDirectory':str(ROOT),'evaluation':'See locally generated artifacts/evaluation.json after approved training'}

@app.post('/ai/classify',dependencies=[Depends(authenticate)])
def classify(payload: ComplaintInput):
    result=predict('category',payload.title+' '+payload.description)
    if result is None:raise HTTPException(status_code=503,detail='Category model not trained')
    return {**result,'modelVersion':'category-baseline-v1'}

@app.post('/ai/priority',dependencies=[Depends(authenticate)])
def priority(payload: ComplaintInput):
    result=predict('priority',payload.title+' '+payload.description)
    if result is None:raise HTTPException(status_code=503,detail='Priority model not trained')
    return {**result,'modelVersion':'priority-baseline-v1'}

@app.post('/ai/duplicates',dependencies=[Depends(authenticate)])
def duplicates(payload: ComplaintInput):
    return {'candidates':duplicate_candidates(payload),'scoreType':'cosine_similarity','status':'SUGGESTIONS_ONLY'}

@app.post('/ai/analyze',dependencies=[Depends(authenticate)])
def combined(payload: ComplaintInput):
    data=analyze(payload)
    # A model outage does not force the core Node complaint workflow to fail.
    if data['status']=='READY' and payload.candidates:
        try:data['duplicates']=duplicate_candidates(payload)
        except HTTPException:data['duplicateStatus']='EMBEDDING_UNAVAILABLE'
    return data

@app.post('/ai/insights',dependencies=[Depends(authenticate)])
def insights(payload: InsightsInput):
    total=sum(payload.categoryCounts.values())
    ordered=sorted(payload.categoryCounts.items(),key=lambda item:item[1],reverse=True)
    return {'period':{'start':payload.startDate,'end':payload.endDate},'source':'caller_supplied_aggregated_counts','total':total,'topCategories':ordered[:5],'isForecast':False}
