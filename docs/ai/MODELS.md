# AI model governance and verification

The FastAPI service is intentionally private to the Node backend. Its role is to **suggest**, not authorize, prioritize officially or close complaints. The baseline training scripts in `ai-service/training/` only accept reviewed labeled CSV files, and save the fitted TF-IDF + Logistic Regression pipeline with a held-out classification report and confusion matrix. No datasets are included.

- Category model: labels must match the nine configured complaint categories. Train with `python training/train_category.py datasets/processed/reviewed_categories.csv`.
- Priority model: reviewed `Critical`, `High`, `Medium`, `Low` labels. Train with `python training/train_priority.py datasets/processed/reviewed_priorities.csv`.
- Duplicate suggestion: Sentence Transformers with cosine similarity. Exact similarity score is **not** a probability. Local model download/configuration must be separately approved. No unreviewed threshold is hardcoded.
- Inference: prediction outputs include model version only when a model is present. No uncalibrated score is called an accuracy value.
- Safety heuristic: Node flags particular safety-related terms for administrator review; this is explicitly rule-based, not a trained classifier and not a final safety judgment.
- Analytics: initial insight counts are reproducible MongoDB aggregations and are **not** machine-learning forecasts.

**No genuine model precision/recall/F1 numbers can be claimed until real reviewed data has been supplied and training/evaluation executed.** Model artifacts and private raw datasets are excluded by `.gitignore`.
