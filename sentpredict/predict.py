import torch
from transformers import BertTokenizer
from BertModel import BertClassifier

BERT_MODEL_PATH = 'bert-base-chinese'
state_dict_path = 'models/best_v1.pt'

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
class_names = ['无抑郁', '轻度抑郁', '中度抑郁', '重度抑郁', '极重度抑郁']

# 加载分词器
tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_PATH)

# 加载模型
model = BertClassifier(BERT_MODEL_PATH)
# 加载训练好的权重
model.load_state_dict(torch.load(state_dict_path, map_location=device))
model.to(device)
# 切换成评估模式
model.eval()

# 单文本预测
def predict_single_text(text):
    # 分词预处理，参数必须和训练时对齐
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

    # 取概率最大的类别作为预测结果
    pred_class = torch.argmax(logits, dim=1).item()
    pred_name = class_names[pred_class]
    # 计算每个类别的概率
    probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    return pred_class, pred_name, probs

# 使用示例
if __name__ == '__main__':
    # test_text = "最近总是睡不着，对什么事情都提不起兴趣，觉得生活没什么意义。"
    # test_text = "在学校一直被欺负，觉得很焦虑和煎熬，感觉要抑郁了。"
    test_text = "今天天气好好，感觉心情都被治愈了。"

    pred_label, pred_name, pred_probs = predict_single_text(test_text)

    print(f'文本：{test_text}')
    print(f"预测等级：{pred_name}（标签编号：{pred_label}）")
    print("各等级置信度：")
    for i, prob in enumerate(pred_probs):
        print(f"    {class_names[i]}: {prob:.4f}")
