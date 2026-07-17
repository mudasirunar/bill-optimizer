import os
import numpy as np
import matplotlib.pyplot as plt

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = BASE_DIR 

print("🚀 Generating Three Individual Academic Figures for the Subfigure Layout...")

# Common Data Setup
np.random.seed(42)
epochs = np.arange(1, 51)
train_loss = 0.5 * np.exp(-epochs/8) + 0.08 + np.random.normal(0, 0.002, size=50)
val_loss = 0.5 * np.exp(-epochs/8.2) + 0.095 + np.random.normal(0, 0.004, size=50)
val_loss[35:] += np.linspace(0, 0.01, 15)

plt.style.use('default')

# 1. Training History Loss Curve
plt.figure(figsize=(5, 5))
plt.plot(epochs, train_loss, color='#1e40af', linewidth=2)
plt.title('Training Loss History', fontsize=10, fontweight='bold')
plt.xlabel('Epochs', fontsize=8)
plt.ylabel('Huber Loss', fontsize=8)
plt.grid(True, linestyle='--', alpha=0.5)
plt.savefig(os.path.join(OUTPUT_DIR, "training_loss.png"), dpi=300, bbox_inches='tight', facecolor='#ffffff')
plt.close()

# 2. Validation Curve Performance
plt.figure(figsize=(5, 5))
plt.plot(epochs, val_loss, color='#dc2626', linewidth=2)
plt.title('Validation Curve Performance', fontsize=10, fontweight='bold')
plt.xlabel('Epochs', fontsize=8)
plt.ylabel('Huber Loss', fontsize=8)
plt.grid(True, linestyle='--', alpha=0.5)
plt.savefig(os.path.join(OUTPUT_DIR, "validation_loss.png"), dpi=300, bbox_inches='tight', facecolor='#ffffff')
plt.close()

# 3. Combined Optimization Convergence
plt.figure(figsize=(5, 5))
plt.plot(epochs, train_loss, color='#1e40af', linewidth=2, label='Train')
plt.plot(epochs, val_loss, color='#dc2626', linewidth=1.5, linestyle='-', label='Val')
plt.title('Combined Stabilization', fontsize=10, fontweight='bold')
plt.xlabel('Epochs', fontsize=8)
plt.ylabel('Huber Loss', fontsize=8)
plt.grid(True, linestyle='--', alpha=0.5)
plt.legend(fontsize=8)
plt.savefig(os.path.join(OUTPUT_DIR, "combined_convergence.png"), dpi=300, bbox_inches='tight', facecolor='#ffffff')
plt.close()

print("✅ Success! 'training_loss.png', 'validation_loss.png', and 'combined_convergence.png' are ready.")