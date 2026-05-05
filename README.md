# Neural Network Hyperparameter Optimisation
### Predicting South Africa's National Electricity Demand (Eskom Grid Data)
 
![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2.21-orange?logo=tensorflow&logoColor=white)
![Keras](https://img.shields.io/badge/Keras-3.14-red?logo=keras&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-latest-f7931e?logo=scikit-learn&logoColor=white)
![pandas](https://img.shields.io/badge/pandas-latest-150458?logo=pandas&logoColor=white)
![Jupyter](https://img.shields.io/badge/Jupyter-Notebook-orange?logo=jupyter&logoColor=white)
![Status](https://img.shields.io/badge/Status-Complete-brightgreen)
 
---
 
## Overview
 
This project systematically evaluates 20 distinct neural network configurations to predict **RSA Contracted Demand (MW)** — South Africa's total national electricity demand per hour — using Eskom's official national grid dataset covering April 2018 to March 2023.
 
The goal was to move beyond a baseline model through principled hyperparameter experimentation, documenting what worked, what didn't, and why. Each of the 20 models is accompanied by a hypothesis, training code, loss/MAE curves, actual vs predicted scatter plot, and a written reflection.
 
**Baseline → Best: 65.74 MW → 60.57 MW Test MAE (8% improvement)**
 
---
 
## Dataset
 
**Eskom National Electricity Grid Dataset (ESK2033.csv)**
 
- **Records:** 43,824 hourly observations (April 2018 – March 2023)
- **Features:** 42 columns covering generation by source, demand forecasts, renewable energy output, installed capacity, load shedding events, and planned/unplanned outages
- **Target Variable:** `RSA Contracted Demand` (MW) — total actual electricity demand contracted across South Africa per hour
- **Source:** Eskom official grid data (not included in this repo due to licensing)
> To reproduce this project, obtain the dataset from Eskom's official data portal and place `ESK2033.csv` in the root directory.
 
---
 
## Problem Statement
 
Accurate electricity demand forecasting is critical for grid operators to manage generation dispatch, prevent load shedding, and balance supply with demand in real time. This project builds and tunes a neural network regression model to predict hourly RSA Contracted Demand from 40 grid features, simulating the kind of ML work done in energy analytics roles.
 
---
 
## Methodology
 
### Preprocessing
- Dropped rows with missing values (NaN)
- Removed the datetime index column
- Separated features (X) from target (y = RSA Contracted Demand)
- Split: 70% training / 15% validation / 15% test
- Scaled all input features using `StandardScaler` (fit on training set only)
### Experiment Design
Each of the 20 models changes at least one hyperparameter from the previous configuration. The hyperparameters explored include:
 
| Hyperparameter | Values Tested |
|---|---|
| Neurons per layer | 64, 128, 256 |
| Hidden layers | 2, 3 |
| Activation function | ReLU, ELU, SELU |
| Optimiser | Adam, RMSprop |
| Batch size | 16, 32, 64 |
| Epochs | 200, 500, 1000 |
| Dropout rate | 0.1, 0.2 |
| Learning rate schedule | ReduceLROnPlateau |
| Early stopping | patience=30 |
 
---
 
## Results Summary
 
| Rank | Model | Test MAE (MW) | Val MAE (MW) | Key Change |
|------|-------|--------------|--------------|------------|
| 1 | Model 14 | **60.57** | 62.74 | Early stopping, ELU, batch 16 |
| 2 | Model 6  | **60.58** | 61.54 | ELU activation ← biggest single gain |
| 3 | Model 11 | 60.74 | 61.51 | LR schedule |
| 4 | Model 15 | 60.75 | 63.50 | SELU activation |
| 5 | Model 9  | 60.92 | 63.46 | 500 epochs |
| ... | ... | ... | ... | ... |
| 20 | Model 7  | 72.56 | 75.50 | RMSprop ← worst |
 
**Baseline (Model 1):** 65.74 MW Test MAE  
**Best (Model 14):** 60.57 MW Test MAE  
**Improvement:** 8% over baseline
 
---
 
## Key Findings
 
**Most impactful positive change:** Switching from ReLU to ELU activation (Model 6) produced the largest single improvement — dropping Test MAE from 63.67 MW to 60.58 MW. ELU allows small negative outputs rather than clamping at zero, which prevents dying neurons and maintains better gradient flow throughout training.
 
**Most negative change:** RMSprop optimiser (Model 7) was the worst configuration at 72.56 MW Test MAE. Adam's momentum and adaptive per-parameter learning rates made it significantly better suited to this high-dimensional regression task.
 
**Dropout was consistently harmful:** Both Dropout(0.2) and Dropout(0.1) increased Test MAE. Eskom's grid features are strongly physically correlated with demand — randomly deactivating neurons breaks these correlations and hurts learning.
 
**Depth didn't help:** Three-layer architectures (Models 3, 4, 19) consistently underperformed the two-layer 128-128 setup. For tabular regression with ~14,000 training samples, additional depth adds optimisation complexity without improving representational capacity.
 
---
 
## Project Structure
 
```
neural-network-hyperparameter-optimisation/
│
├── 219119007_Ledwaba_T_AI_HOMEWORK2_FINAL.ipynb   # Main notebook (20 models)
└── README.md
```
 
---
 
## Tech Stack
 
- **Python 3.13**
- **TensorFlow 2.21 / Keras 3.14** — model building and training
- **scikit-learn** — preprocessing (StandardScaler, train_test_split, MAE)
- **pandas** — data manipulation and results summary
- **matplotlib** — loss curves, MAE curves, scatter plots
- **Google Colab (T4 GPU)** — training environment
---
 
## How to Run
 
```bash
# Clone the repo
git clone https://github.com/ThebeLedwaba/neural-network-hyperparameter-optimisation.git
cd neural-network-hyperparameter-optimisation
 
# Install dependencies
pip install tensorflow pandas scikit-learn matplotlib jupyter
 
# Place ESK2033.csv in the root directory
# Update the file_path variable in the notebook to point to your CSV
 
# Launch Jupyter
jupyter notebook
```
 
> **Recommended:** Run on Google Colab with a T4 GPU for faster training. Upload `ESK2033.csv` to `/content/` and update the file path accordingly.
 
---
 
## Author
 
**Thebe Ledwaba**  
Computer Systems Engineering (Advanced Diploma, NQF 7)  
Vaal University of Technology  
 
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://linkedin.com/in/thebe-ledwaba)
[![GitHub](https://img.shields.io/badge/GitHub-ThebeLedwaba-black?logo=github)](https://github.com/ThebeLedwaba)
[![Portfolio](https://img.shields.io/badge/Portfolio-thebeledwabawebsite.netlify.app-brightgreen)](https://thebeledwabawebsite.netlify.app)
 
---
 
*Part of an ongoing portfolio in ML/Data Science, Embedded Systems, and Full-Stack Development.*
