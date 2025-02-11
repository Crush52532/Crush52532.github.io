import os
import numpy as np
import pandas as pd
import joblib
import scipy.io
import json
from datetime import datetime
import logging

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('emotion_analysis.log'),
        logging.StreamHandler()
    ]
)

def get_latest_file(directory):
    """获取目录中最新的数据文件"""
    files = [f for f in os.listdir(directory) if f.endswith(('.csv', '.npy', '.mat'))]
    if not files:
        return None
    
    # 根据文件名中的时间戳排序
    latest_file = max(files, key=lambda x: x.split('_')[0])
    return os.path.join(directory, latest_file)

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

def analyze_latest_data():
    """分析最新上传的数据文件"""
    try:
        logging.info("开始分析最新数据")
        
        # 加载模型
        model_path = os.path.join('models', 'svm_emotion_model.pkl')
        if not os.path.exists(model_path):
            logging.error(f"模型文件不存在: {model_path}")
            raise FileNotFoundError("找不到模型文件")
        
        model = joblib.load(model_path)
        logging.info("成功加载模型")
        
        results = []
        data_dir = 'data'
        
        # 检查每个数据类型的最新文件
        for data_type in ['ppg', 'ecg', 'gsr']:
            type_dir = os.path.join(data_dir, data_type)
            if not os.path.exists(type_dir):
                logging.warning(f"目录不存在: {type_dir}")
                continue
            
            latest_file_path = get_latest_file(type_dir)
            if not latest_file_path:
                logging.info(f"在 {data_type} 目录中没有找到数据文件")
                continue
            
            try:
                file_name = os.path.basename(latest_file_path)
                logging.info(f"处理 {data_type} 最新文件: {file_name}")
                
                # 转换数据
                data = convert_to_npy(latest_file_path, data_type)
                logging.info(f"数据形状: {data.shape}")
                
                # 确保数据是二维数组
                if data.ndim == 1:
                    data = data.reshape(1, -1)
                
                # 预测情绪
                predicted_label = model.predict(data)[0]
                logging.info(f"预测结果: {predicted_label}")
                
                # 获取文件时间戳
                timestamp = file_name.split('_')[0]
                time_str = datetime.strptime(timestamp, '%Y%m%d%H%M%S').strftime('%Y-%m-%d %H:%M:%S')
                
                result = {
                    'file_name': file_name,
                    'data_type': data_type,
                    'time': time_str,
                    'emotion': str(predicted_label),
                    'processed_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                results.append(result)
                
                logging.info(f"成功处理文件: {file_name}")
                
            except Exception as e:
                logging.error(f"处理文件 {latest_file_path} 时出错: {str(e)}")
                continue
        
        # 保存分析结果
        if results:
            results_file = 'analysis_results.json'
            
            # 读取现有结果（如果存在）
            existing_results = []
            if os.path.exists(results_file):
                with open(results_file, 'r', encoding='utf-8') as f:
                    existing_results = json.load(f)
            
            # 添加新结果
            existing_results.extend(results)
            
            # 保存更新后的结果
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(existing_results, f, ensure_ascii=False, indent=2)
            
            logging.info(f"结果已保存到 {results_file}")
            
            return results
        else:
            logging.warning("没有找到需要分析的新数据")
            return None
        
    except Exception as e:
        logging.error(f"分析过程出错: {str(e)}")
        return None

if __name__ == '__main__':
    analyze_latest_data()
