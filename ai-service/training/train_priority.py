"""Optional priority baseline. Train only with reviewed priority labels.
Usage: python training/train_priority.py datasets/processed/reviewed_priorities.csv
Columns title,description,priority. No synthetic training labels.
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
from sklearn.metrics import classification_report, confusion_matrix

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: python training/train_priority.py <reviewed.csv>')
    source=pathlib.Path(sys.argv[1]);df=pd.read_csv(source)
    keys={'title','description','priority'}
    if not keys.issubset(df.columns):raise SystemExit('Missing title, description or priority')
    df=df.dropna(subset=list(keys))
    levels=Counter(df.priority)
    if any(x not in {'Critical','High','Medium','Low'} for x in levels):raise SystemExit('Unknown priority labels')
    if len(levels)<2 or min(levels.values())<5:raise SystemExit('Need reviewed examples for at least two classes (5+ each)')
    x=df.title.astype(str).str.cat(df.description.astype(str),sep=' ')
    xt,xh,yt,yh=train_test_split(x,df.priority,test_size=.25,stratify=df.priority,random_state=42)
    pipe=Pipeline([('tfidf',TfidfVectorizer(ngram_range=(1,2))),('classifier',LogisticRegression(class_weight='balanced',max_iter=1500))]);pipe.fit(xt,yt)
    predictions=pipe.predict(xh);classes=sorted(levels)
    out=pathlib.Path('artifacts');out.mkdir(parents=True,exist_ok=True)
    joblib.dump(pipe,out/'priority.joblib')
    result={'model':'Priority TF-IDF + LogisticRegression','modelVersion':'priority-baseline-v1','samples':len(df),'heldOutSamples':len(xh),'classCounts':levels,'classes':classes,'classificationReport':classification_report(yh,predictions,output_dict=True,zero_division=0),'confusionMatrix':confusion_matrix(yh,predictions,labels=classes).tolist(),'datasetFilename':source.name}
    (out/'priority_evaluation.json').write_text(json.dumps(result,indent=2));print('Holdout macro F1:',result['classificationReport']['macro avg']['f1-score'])
