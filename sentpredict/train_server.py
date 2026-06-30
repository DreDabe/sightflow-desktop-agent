import sys
import os
import json
import signal

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stdin.encoding != 'utf-8':
    sys.stdin.reconfigure(encoding='utf-8')

if not os.environ.get('HF_ENDPOINT'):
    os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

import kagglehub
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer
from torch import nn
from torch.optim import Adam
from tqdm import tqdm
import numpy as np
import random
from BertModel import BertClassifier


class MyDataset(Dataset):
    def __init__(self, df, tokenizer):
        df['text'] = df['text'].astype(str)
        self.texts = [tokenizer(text,
                                padding='max_length',
                                max_length=350,
                                truncation=True,
                                return_tensors="pt")
                      for text in df['text']]
        self.labels = [label for label in df['label']]

    def __getitem__(self, idx):
        return self.texts[idx], self.labels[idx]

    def __len__(self):
        return len(self.labels)


def setup_seed(seed):
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    np.random.seed(seed)
    random.seed(seed)
    torch.backends.cudnn.deterministic = True


def send_event(event_type, data):
    sys.stdout.write(json.dumps({'type': event_type, **data}, ensure_ascii=False) + '\n')
    sys.stdout.flush()


def handle_shutdown(signum, frame):
    send_event('interrupted', {'message': '训练被中断'})
    sys.exit(0)


signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)

send_event('started', {'message': '正在下载数据集...'})

try:
    dataset_path = kagglehub.dataset_download("kyharndeok/dpreesion")
    train_path = os.path.join(dataset_path, "train.zh.tsv")
    dev_path = os.path.join(dataset_path, "dev.zh.tsv")

    train_df = pd.read_csv(train_path, delimiter='\t', encoding='utf-8')
    dev_df = pd.read_csv(dev_path, delimiter='\t', encoding='utf-8')
    train_df = train_df[['text', 'label']]
    dev_df = dev_df[['text', 'label']]

    send_event('data_loaded', {
        'train_size': len(train_df),
        'dev_size': len(dev_df)
    })
except Exception as e:
    send_event('error', {'message': f'数据集加载失败: {str(e)}'})
    sys.exit(1)

BERT_MODEL_PATH = 'bert-base-chinese'

try:
    send_event('progress', {'message': '正在加载 BERT 分词器...'})
    try:
        tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_PATH, local_files_only=True)
    except Exception:
        tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_PATH)
except Exception as e:
    send_event('error', {'message': f'分词器加载失败: {str(e)}'})
    sys.exit(1)

epoch = 7
batch_size = 32
lr = 1e-5
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
random_seed = 2023
save_path = os.environ.get('SENTIMENT_MODEL_DIR', 'models')

setup_seed(random_seed)

send_event('progress', {
    'message': f'正在构建数据集 (device: {device})...',
    'device': str(device)
})

train_dataset = MyDataset(train_df, tokenizer)
dev_dataset = MyDataset(dev_df, tokenizer)

model = BertClassifier(BERT_MODEL_PATH)
criterion = nn.CrossEntropyLoss()
optimizer = Adam(model.parameters(), lr=lr)
model = model.to(device)
criterion = criterion.to(device)

train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
dev_loader = DataLoader(dev_dataset, batch_size=batch_size)

best_dev_acc = 0
best_val_loss = float('inf')
patience = 3
trigger_times = 0

send_event('training', {'total_epochs': epoch, 'message': '开始训练'})

for epoch_num in range(epoch):
    model.train()
    total_acc_train = 0
    total_loss_train = 0

    for batch_idx, (inputs, labels) in enumerate(train_loader):
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

    train_acc = total_acc_train / len(train_dataset)
    train_loss = total_loss_train / len(train_dataset)

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

    val_acc = total_acc_val / len(dev_dataset)
    val_loss = total_loss_val / len(dev_dataset)

    send_event('epoch', {
        'epoch': epoch_num + 1,
        'total_epochs': epoch,
        'train_loss': round(train_loss, 4),
        'train_acc': round(train_acc, 4),
        'val_loss': round(val_loss, 4),
        'val_acc': round(val_acc, 4)
    })

    if val_loss < best_val_loss:
        best_val_loss = val_loss
        trigger_times = 0
    else:
        trigger_times += 1
        if trigger_times >= patience:
            send_event('early_stop', {'epoch': epoch_num + 1, 'message': f'早停于第 {epoch_num + 1} 轮'})
            break

    if val_acc > best_dev_acc:
        best_dev_acc = val_acc
        if not os.path.exists(save_path):
            os.makedirs(save_path)
        torch.save(model.state_dict(), os.path.join(save_path, 'best.pt'))
        send_event('saved', {'epoch': epoch_num + 1, 'val_acc': round(val_acc, 4), 'message': f'模型已保存 (val_acc={val_acc:.4f})'})

send_event('completed', {'best_val_acc': round(best_dev_acc, 4), 'message': f'训练完成，最佳验证准确率: {best_dev_acc:.4f}'})
