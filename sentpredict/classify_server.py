import sys
import os
import json
import signal

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stdin.encoding != 'utf-8':
    sys.stdin.reconfigure(encoding='utf-8')

import torch

if not os.environ.get('HF_ENDPOINT'):
    os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

from transformers import BertTokenizer
from BertModel import BertClassifier

BERT_MODEL_PATH = 'bert-base-chinese'
STATE_DICT_PATH = 'models/best_v2.pt'
CLASS_NAMES = ['无抑郁', '轻度抑郁', '中度抑郁', '重度抑郁', '极重度抑郁']

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

try:
    try:
        tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_PATH, local_files_only=True)
    except Exception:
        tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_PATH)

    try:
        model = BertClassifier(BERT_MODEL_PATH)
        model.bert = model.bert.from_pretrained(BERT_MODEL_PATH, local_files_only=True)
    except Exception:
        model = BertClassifier(BERT_MODEL_PATH)

    model.load_state_dict(torch.load(STATE_DICT_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()

    sys.stdout.write(json.dumps({'status': 'ready'}, ensure_ascii=False) + '\n')
    sys.stdout.flush()
except Exception as e:
    sys.stdout.write(json.dumps({'status': 'error', 'error': str(e)}, ensure_ascii=False) + '\n')
    sys.stdout.flush()
    sys.exit(1)


def predict(text):
    encoded = tokenizer(
        text,
        padding='max_length',
        max_length=350,
        truncation=True,
        return_tensors='pt'
    )
    input_ids = encoded['input_ids'].to(device)
    attention_mask = encoded['attention_mask'].to(device)

    with torch.no_grad():
        logits = model(input_ids, attention_mask)

    pred_class = torch.argmax(logits, dim=1).item()
    pred_name = CLASS_NAMES[pred_class]
    probs = torch.softmax(logits, dim=1).cpu().numpy()[0].tolist()

    return {
        'classIndex': pred_class,
        'className': pred_name,
        'probabilities': probs
    }


def handle_shutdown(signum, frame):
    sys.exit(0)


signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    if line.lower() == 'exit':
        break
    try:
        data = json.loads(line)
        text = data.get('text', '')
        if not text:
            result = {'error': 'empty text'}
        else:
            result = predict(text)
    except json.JSONDecodeError:
        result = {'error': 'invalid json'}
    except Exception as e:
        result = {'error': str(e)}

    sys.stdout.write(json.dumps(result, ensure_ascii=False) + '\n')
    sys.stdout.flush()
