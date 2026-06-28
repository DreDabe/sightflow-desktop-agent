import kagglehub
import pandas as pd
import torch
from sklearn.utils import compute_class_weight
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer
from torch import nn
from torch.optim import Adam
from tqdm import tqdm
import numpy as np
import random
import os
from sklearn.metrics import accuracy_score, classification_report, f1_score
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, auc
from sklearn.preprocessing import label_binarize
from BertModel import BertClassifier

# 自定义数据集类
class MyDataset(Dataset):
    def __init__(self, df):
        # 确保所有文本都是字符串类型
        df['text'] = df['text'].astype(str)

        # tokenizer分词后可以被自动汇聚
        self.texts = [tokenizer(text,
                                padding='max_length',  # 填充到最大长度
                                max_length=350,  # 经过数据分析，最大长度为350
                                truncation=True,
                                return_tensors="pt")
                      for text in df['text']]
        # Dataset会自动返回Tensor
        self.labels = [label for label in df['label']]

    def __getitem__(self, idx):
        return self.texts[idx], self.labels[idx]

    def __len__(self):
        return len(self.labels)


# 设置随机种子
def setup_seed(seed):
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    np.random.seed(seed)
    random.seed(seed)
    torch.backends.cudnn.deterministic = True


# 保存模型和优化器
def save_model(save_path, save_name, model, optimizer=None):
    if not os.path.exists(save_path):
        os.makedirs(save_path)
    torch.save(model.state_dict(), os.path.join(save_path, save_name))
    if optimizer:
        torch.save(optimizer.state_dict(), os.path.join(save_path, f"{save_name}_optimizer.pt"))

if __name__ == '__main__':
    # 下载数据集
    dataset_path = kagglehub.dataset_download("kyharndeok/dpreesion")
    # 数据集路径
    train_path = os.path.join(dataset_path, "train.zh.tsv")
    test_path = os.path.join(dataset_path, "test.zh.tsv")
    dev_path = os.path.join(dataset_path, "dev.zh.tsv")

    # 读取数据
    train_df = pd.read_csv(train_path, delimiter='\t', encoding='utf-8')
    test_df = pd.read_csv(test_path, delimiter='\t', encoding='utf-8')
    dev_df = pd.read_csv(dev_path, delimiter='\t', encoding='utf-8')

    train_df = train_df[['text', 'label']]
    test_df = test_df[['text', 'label']]
    dev_df = dev_df[['text', 'label']]

    # 基于中文的预训练bert模型
    BERT_MODEL_PATH = 'bert-base-chinese'

    # 加载分词器
    tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_PATH)

    # 训练超参数
    epoch = 7
    batch_size = 32
    lr = 1e-5
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    random_seed = 2023
    save_path = 'models'

    setup_seed(random_seed)

    # 计算类别权重
    class_weights = compute_class_weight('balanced', classes=np.unique(train_df['label']), y=train_df['label'])
    class_weights = torch.tensor(class_weights, dtype=torch.float32).to(device)

    # 创建数据集
    train_dataset = MyDataset(train_df)
    dev_dataset = MyDataset(dev_df)
    test_dataset = MyDataset(test_df)

    # 定义模型、损失函数和优化器
    model = BertClassifier(BERT_MODEL_PATH)
    criterion = nn.CrossEntropyLoss()
    optimizer = Adam(model.parameters(), lr=lr)
    model = model.to(device)
    criterion = criterion.to(device)

    # 构建数据加载器
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    dev_loader = DataLoader(dev_dataset, batch_size=batch_size)
    test_loader = DataLoader(test_dataset, batch_size=batch_size)

    # 记录训练和验证损失
    train_losses = []
    val_losses = []

    # 训练
    best_dev_acc = 0
    best_val_loss = float('inf')
    patience = 3
    trigger_times = 0

    for epoch_num in range(epoch):
        total_acc_train = 0
        total_loss_train = 0
        for inputs, labels in tqdm(train_loader):
            input_ids = inputs['input_ids'].squeeze(1).to(device)
            masks = inputs['attention_mask'].to(device)
            labels = labels.to(device)
            output = model(input_ids, masks)

            batch_loss = criterion(output, labels)
            batch_loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            acc = (output.argmax(dim=1) == labels).sum().item()
            total_acc_train += acc
            total_loss_train += batch_loss.item()

        # 记录训练损失
        train_losses.append(total_loss_train / len(train_dataset))

        # 验证模型
        model.eval()
        total_acc_val = 0
        total_loss_val = 0
        with torch.no_grad():
            for inputs, labels in dev_loader:
                input_ids = inputs['input_ids'].squeeze(1).to(device)
                masks = inputs['attention_mask'].to(device)
                labels = labels.to(device)
                output = model(input_ids, masks)

                batch_loss = criterion(output, labels)
                acc = (output.argmax(dim=1) == labels).sum().item()
                total_acc_val += acc
                total_loss_val += batch_loss.item()

            # 记录验证损失
            val_losses.append(total_loss_val / len(dev_dataset))

            print(f'''Epochs: {epoch_num + 1}
              | Train Loss: {train_losses[-1]: .3f}
              | Train Accuracy: {total_acc_train / len(train_dataset): .3f}
              | Val Loss: {val_losses[-1]: .3f}
              | Val Accuracy: {total_acc_val / len(dev_dataset): .3f}''')

            # 早停机制
            if val_losses[-1] < best_val_loss:
                best_val_loss = val_losses[-1]
                trigger_times = 0
            else:
                trigger_times += 1
                if trigger_times >= patience:
                    print("Early stopping!")
                    break

            # 保存最优的模型
            if total_acc_val / len(dev_dataset) > best_dev_acc:
                best_dev_acc = total_acc_val / len(dev_dataset)
                save_model(save_path, 'best.pt', model, optimizer)

        model.train()

    # 保存最后的模型和优化器
    save_model(save_path, 'last.pt', model, optimizer)

    # 绘制 Loss 曲线
    plt.figure(figsize=(10, 5))
    plt.plot(range(1, len(train_losses) + 1), train_losses, label='Train Loss')
    plt.plot(range(1, len(val_losses) + 1), val_losses, label='Validation Loss')
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    plt.title('Training and Validation Loss Curve')
    plt.legend()
    plt.grid()
    plt.savefig('loss_curve.png')
    plt.show()

    # 测试集评估
    model.eval()
    y_true = []
    y_pred = []
    y_score = []  # 用于存储预测概率
    total_loss_test = 0

    with torch.no_grad():
        for inputs, labels in test_loader:
            input_ids = inputs['input_ids'].squeeze(1).to(device)
            masks = inputs['attention_mask'].to(device)
            labels = labels.to(device)
            output = model(input_ids, masks)

            batch_loss = criterion(output, labels)
            total_loss_test += batch_loss.item()
            y_true.extend(labels.cpu().numpy())
            y_pred.extend(output.argmax(dim=1).cpu().numpy())
            y_score.extend(torch.softmax(output, dim=1).cpu().numpy())  # 获取预测概率

    # 计算测试集指标
    test_accuracy = accuracy_score(y_true, y_pred)
    test_loss = total_loss_test / len(test_dataset)

    # 动态生成 target_names
    num_classes = len(np.unique(y_true))
    target_names = [str(i) for i in range(num_classes)]

    # 计算分类报告
    test_classification_rep = classification_report(y_true, y_pred, target_names=target_names)
    test_f1 = f1_score(y_true, y_pred, average="weighted")

    # 计算每个类别的准确率
    class_accuracy = {}
    for i in range(num_classes):
        class_mask = np.array(y_true) == i
        class_accuracy[i] = accuracy_score(np.array(y_true)[class_mask], np.array(y_pred)[class_mask])

    # 输出测试集结果
    print(f"Test Accuracy: {test_accuracy:.4f}")
    print(f"Test Loss: {test_loss:.4f}")
    print(f"Test F1 Score (weighted): {test_f1:.4f}")
    print("\nClassification Report:")
    print(test_classification_rep)
    print("\nClass-wise Accuracy:")
    for class_id, acc in class_accuracy.items():
        print(f"Class {class_id}: {acc:.4f}")

    # 绘制 ROC 曲线
    y_true_bin = label_binarize(y_true, classes=np.arange(num_classes))  # 将标签二值化
    y_score = np.array(y_score)  # 转换为 numpy 数组

    # 计算每个类别的 ROC 曲线和 AUC
    fpr = dict()
    tpr = dict()
    roc_auc = dict()
    for i in range(num_classes):
        fpr[i], tpr[i], _ = roc_curve(y_true_bin[:, i], y_score[:, i])
        roc_auc[i] = auc(fpr[i], tpr[i])

    # 绘制 ROC 曲线
    plt.figure(figsize=(10, 5))
    for i in range(num_classes):
        plt.plot(fpr[i], tpr[i], label=f'Class {i} (AUC = {roc_auc[i]:.2f})')
    plt.plot([0, 1], [0, 1], 'k--')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('ROC Curve')
    plt.legend()
    plt.grid()
    plt.savefig("ROC_curve.png")
    plt.show()