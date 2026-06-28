from torch import nn
from transformers import BertModel

# 定义BERT分类模型
class BertClassifier(nn.Module):
    def __init__(self, BERT_MODEL_PATH):
        super(BertClassifier, self).__init__()
        self.bert = BertModel.from_pretrained(BERT_MODEL_PATH)
        self.dropout = nn.Dropout(0.5)
        self.linear = nn.Linear(768, 5)

    def forward(self, input_id, mask):
        _, pooled_output = self.bert(input_ids=input_id, attention_mask=mask, return_dict=False)
        dropout_output = self.dropout(pooled_output)
        linear_output = self.linear(dropout_output)
        return linear_output