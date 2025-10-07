import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, AdaBoostRegressor
from sklearn.svm import SVR
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

def enhanced_training():
    """
    ENHANCED training with multiple algorithms and hyperparameter tuning
    """
    print("🧠 ENHANCED MODEL TRAINING STARTING...")
    
    try:
        # Load enhanced preprocessed data
        print("📂 Loading enhanced preprocessed data...")
        df = pd.read_csv('preprocessed_enhanced.csv')
        feature_columns = joblib.load('feature_columns_enhanced.pkl')
        
        X = df[feature_columns]
        y = df['monthly_bill']
        
        print(f"✅ Training data: {X.shape[0]} samples, {X.shape[1]} features")
        print(f"💰 Target range: Rs. {y.min():.2f} - Rs. {y.max():.2f}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, shuffle=True
        )
        
        # DEFINE ENHANCED MODELS
        models = {
            'Random Forest': {
                'model': RandomForestRegressor(random_state=42),
                'params': {
                    'n_estimators': [100, 200],
                    'max_depth': [10, 15, None],
                    'min_samples_split': [2, 5]
                }
            },
            'Gradient Boosting': {
                'model': GradientBoostingRegressor(random_state=42),
                'params': {
                    'n_estimators': [100, 200],
                    'learning_rate': [0.1, 0.05],
                    'max_depth': [3, 4, 5]
                }
            },
            'Support Vector Regression': {
                'model': SVR(),
                'params': {
                    'C': [0.1, 1, 10],
                    'kernel': ['linear', 'rbf']
                }
            },
            'Ridge Regression': {
                'model': Ridge(random_state=42),
                'params': {
                    'alpha': [0.1, 1.0, 10.0]
                }
            },
            'AdaBoost': {
                'model': AdaBoostRegressor(random_state=42),
                'params': {
                    'n_estimators': [50, 100],
                    'learning_rate': [0.1, 1.0]
                }
            }
        }
        
        best_model = None
        best_score = -np.inf
        best_model_name = ""
        results = {}
        
        print("\n🎯 TRAINING MULTIPLE MODELS WITH HYPERPARAMETER TUNING...")
        
        for name, config in models.items():
            print(f"\n🔧 Training {name}...")
            
            try:
                # Perform grid search with cross-validation
                grid_search = GridSearchCV(
                    config['model'], 
                    config['params'], 
                    cv=5, 
                    scoring='r2',
                    n_jobs=-1,
                    verbose=0
                )
                
                grid_search.fit(X_train, y_train)
                
                # Get best model
                model = grid_search.best_estimator_
                
                # Predictions
                y_pred = model.predict(X_test)
                
                # Calculate metrics
                mae = mean_absolute_error(y_test, y_pred)
                rmse = np.sqrt(mean_squared_error(y_test, y_pred))
                r2 = r2_score(y_test, y_pred)
                
                # Cross-validation scores
                cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
                
                # Store results
                results[name] = {
                    'model': model,
                    'mae': mae,
                    'rmse': rmse,
                    'r2': r2,
                    'cv_mean': cv_scores.mean(),
                    'cv_std': cv_scores.std(),
                    'best_params': grid_search.best_params_
                }
                
                print(f"   ✅ Best params: {grid_search.best_params_}")
                print(f"   📊 MAE: Rs. {mae:.2f}")
                print(f"   📊 RMSE: Rs. {rmse:.2f}")
                print(f"   📊 R²: {r2:.4f}")
                print(f"   📊 Cross-val R²: {cv_scores.mean():.4f} (±{cv_scores.std():.4f})")
                
                # Update best model
                if r2 > best_score:
                    best_score = r2
                    best_model = model
                    best_model_name = name
                    
            except Exception as e:
                print(f"   ❌ Error training {name}: {e}")
                continue
        
        # DISPLAY COMPREHENSIVE RESULTS
        print(f"\n🏆 MODEL COMPARISON:")
        print("="*80)
        for name, result in sorted(results.items(), key=lambda x: x[1]['r2'], reverse=True):
            print(f"{name:20} | R²: {result['r2']:.4f} | MAE: Rs. {result['mae']:.2f} | RMSE: Rs. {result['rmse']:.2f}")
        
        print(f"\n🎯 BEST MODEL: {best_model_name}")
        print(f"   R² Score: {best_score:.4f}")
        
        # FEATURE IMPORTANCE ANALYSIS
        if hasattr(best_model, 'feature_importances_'):
            print(f"\n📊 FEATURE IMPORTANCE (Top 10):")
            feature_importance = pd.DataFrame({
                'feature': feature_columns,
                'importance': best_model.feature_importances_
            }).sort_values('importance', ascending=False)
            
            for i, (_, row) in enumerate(feature_importance.head(10).iterrows(), 1):
                print(f"   {i:2d}. {row['feature']:25} : {row['importance']:.4f}")
        
        # SAVE ENHANCED MODEL AND METADATA
        print(f"\n💾 Saving enhanced model...")
        joblib.dump(best_model, 'bill_predictor_enhanced.pkl')
        
        # Enhanced metadata
        model_metadata = {
            'model_name': best_model_name,
            'model_type': type(best_model).__name__,
            'features_used': feature_columns,
            'feature_importance': feature_importance.to_dict('records') if hasattr(best_model, 'feature_importances_') else None,
            'performance': {
                'r2_score': best_score,
                'mae': results[best_model_name]['mae'],
                'rmse': results[best_model_name]['rmse'],
                'cv_r2_mean': results[best_model_name]['cv_mean'],
                'cv_r2_std': results[best_model_name]['cv_std']
            },
            'best_parameters': results[best_model_name]['best_params'],
            'training_date': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'dataset_info': {
                'total_houses': len(df),
                'total_features': len(feature_columns),
                'target_mean': y.mean(),
                'target_std': y.std()
            },
            'all_model_results': results
        }
        
        joblib.dump(model_metadata, 'model_metadata_enhanced.pkl')
        
        # PREDICTION ACCURACY ANALYSIS
        print(f"\n📈 PREDICTION ACCURACY ANALYSIS:")
        y_pred_best = best_model.predict(X_test)
        accuracy_within_10_percent = np.mean(np.abs((y_pred_best - y_test) / y_test) <= 0.1) * 100
        accuracy_within_20_percent = np.mean(np.abs((y_pred_best - y_test) / y_test) <= 0.2) * 100
        
        print(f"   Predictions within 10% of actual: {accuracy_within_10_percent:.1f}%")
        print(f"   Predictions within 20% of actual: {accuracy_within_20_percent:.1f}%")
        
        print(f"\n🎉 ENHANCED TRAINING COMPLETED!")
        print(f"📁 Model saved: bill_predictor_enhanced.pkl")
        print(f"📁 Metadata saved: model_metadata_enhanced.pkl")
        
        return best_model, best_score, feature_columns
        
    except Exception as e:
        print(f"❌ Error in enhanced training: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None, None

if __name__ == "__main__":
    enhanced_training()