import os
import numpy as np
import pandas as pd
import joblib
import scipy.io
import json
from datetime import datetime

def convert_to_npy(file_path, file_type):
    """
    将不同格式的文件转换为 npy 格式
    """
    try:
        if file_path.endswith('.npy'):
            return np.load(file_path)
        elif file_path.endswith('.csv'):
            # 读取 CSV 文件，假设数据在第一列开始
            data = pd.read_csv(file_path)
            return data.values
        elif file_path.endswith('.mat'):
            # 读取 MAT 文件，获取第一个变量
            mat_data = scipy.io.loadmat(file_path)
            # 获取第一个不是特殊变量（不以 '__' 开头）的数据
            data_key = [k for k in mat_data.keys() if not k.startswith('__')][0]
            return mat_data[data_key]
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")
    except Exception as e:
        raise Exception(f"转换文件 {file_path} 时出错: {str(e)}")

def analyze_emotion_data():
    """
    分析情绪数据并保存结果
    """
    try:
        # 加载模型
        model_path = os.path.join('models', 'svm_emotion_model.pkl')
        if not os.path.exists(model_path):
            raise FileNotFoundError("找不到模型文件")
        
        model = joblib.load(model_path)
        
        # 初始化结果列表
        results = []
        
        # 处理每种类型的数据
        data_dir = 'data'
        for data_type in ['ppg', 'ecg', 'gsr']:
            type_dir = os.path.join(data_dir, data_type)
            if not os.path.exists(type_dir):
                continue
                
            for file in os.listdir(type_dir):
                if file.endswith(('.csv', '.npy', '.mat')):
                    file_path = os.path.join(type_dir, file)
                    try:
                        # 转换数据为 npy 格式
                        data = convert_to_npy(file_path, data_type)
                        
                        # 确保数据是二维数组
                        if data.ndim == 1:
                            data = data.reshape(1, -1)
                        
                        # 预测情绪
                        predicted_label = model.predict(data)[0]
                        
                        # 获取文件时间戳（从文件名中提取）
                        timestamp = file.split('_')[0]
                        time_str = datetime.strptime(timestamp, '%Y%m%d%H%M%S').strftime('%Y-%m-%d %H:%M:%S')
                        
                        # 保存结果
                        result = {
                            'file_name': file,
                            'data_type': data_type,
                            'time': time_str,
                            'emotion': str(predicted_label),
                            'processed_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        }
                        results.append(result)
                        
                        # 将转换后的数据保存为 npy 文件（如果原格式不是 npy）
                        if not file.endswith('.npy'):
                            npy_file = os.path.splitext(file_path)[0] + '.npy'
                            np.save(npy_file, data)
                            
                        print(f"成功处理文件 {file}: 预测情绪 = {predicted_label}")
                        
                    except Exception as e:
                        print(f"处理文件 {file} 时出错: {str(e)}")
                        continue
        
        # 保存分析结果
        results_file = 'analysis_results.json'
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        print(f"分析完成，结果已保存到 {results_file}")
        
        return results
        
    except Exception as e:
        print(f"分析过程出错: {str(e)}")
        return None

if __name__ == '__main__':
    analyze_emotion_data()
