"""Controlled TF-IDF+LogisticRegression baseline. Requires REAL reviewed labels.

Usage: python training/train_category.py datasets/processed/reviewed_categories.csv
CSV columns: title,description,category
"""
import json
import sys
import pathlib
from collections import Counter
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report,confusion_matrix

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: python training/train_category.py <reviewed.csv>')
    source=pathlib.Path(sys.argv[1]);df=pd.read_csv(source)
    columns={'title','description','category'}
    if not columns.issubset(df.columns):raise SystemExit('Missing required title, description or category column')
    df=df.dropna(subset=list(columns)).copy()
    counts=Counter(df['category'])
    if len(counts)<2 or min(counts.values())<5:raise SystemExit('At least two reviewed categories and five samples per class are required')
    x=df['title'].astype(str).str.cat(df['description'].astype(str),sep=' ')
    y=df['category'].astype(str)
    xtrain,xtest,ytrain,ytest=train_test_split(x,y,test_size=0.25,random_state=42,stratify=y)
    pipe=Pipeline([('tfidf',TfidfVectorizer(ngram_range=(1,2),max_features=25000)),('classifier',LogisticRegression(max_iter=1500,class_weight='balanced'))]);pipe.fit(xtrain,ytrain)
    preds=pipe.predict(xtest)
    report=classification_report(ytest,preds,output_dict=True,zero_division=0)
    labels=sorted(y.unique())
    out=pathlib.Path('artifacts');out.mkdir(parents=True,exist_ok=True)
    joblib.dump(pipe,out/'category.joblib')
    (out/'evaluation.json').write_text(json.dumps({'model':'TF-IDF + LogisticRegression','modelVersion':'category-baseline-v1','samples':len(df),'heldOutSamples':len(xtest),'classes':labels,'classCounts':counts,'classificationReport':report,'confusionMatrix':confusion_matrix(ytest,preds,labels=labels).tolist(),'datasetFilename':source.name,'labelReviewRequired':True},indent=2))
    print('Model saved to',out/'category.joblib','held-out macro F1:',report['macro avg']['f1-score'])
