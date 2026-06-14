import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.svm import SVR
import numpy as np
import math
from sklearn.metrics import mean_squared_error


def read_data(path_to_data, include_range_feature):
    ## In case you want to examine the  model with the generation length feature, replace the filename below with
    ## species_w_pop_reports_w_ranges_and_gen_length.csv
    training = pd.read_csv(path_to_data+'species_w_pop_reports_w_ranges.csv')
    to_infer = pd.read_csv(path_to_data+'species_to_infer_w_ranges.csv')

    df = pd.concat(
        [training,to_infer],
        keys=['labeled', 'not_labeled'], names=['labeled'], sort=True
    ).set_index('binomial', append=True).rename_axis(['labeled', 'id', 'binomial'])
    common_names = pd.read_csv(path_to_data+'common_names.csv')
    common_names = common_names.set_index('binomial').drop(['Unnamed: 0'], axis=1)
    nearest_order = pd.read_csv(path_to_data + 'nearest_phylo_order.csv')
    nearest_order_dict = dict(zip(nearest_order.Order, nearest_order.nearest_order))
    df['Order'] = df['Order'].replace(nearest_order_dict)
    df = df.join(common_names, on='binomial')
    return [df, include_range_feature]

def generate_norm_dist(mu):
    return np.random.normal(mu,0.35, 10000)

def preproc_data(data_raw, include_range_feature):
    numerical_columns_rename = dict(Range_km_2='range', AdultBodyMassG='body_mass', gen_length_d='gen_length',
                                    total_pop='population')
    data = (data_raw.rename(columns=numerical_columns_rename))
    data = data[data.range > 0]
    data['RedListStatus'] = data['RedListStatus'].replace('DD', 'LC')
    data = data[data.RedListStatus != 'EX']
    data = data.assign(log_range=np.log(data.range),
                       log_body_mass=np.log(data.body_mass),
                       log_pop=np.log(data.population),
                       # In case you want to examine the  model with the generation length feature uncomment the line below
                       # log_gen_length = np.log(data.gen_length)
                       )
    data = data.assign(log_pop_dist=data['log_pop'].apply(generate_norm_dist))

    red_list_status = pd.get_dummies(data.RedListStatus, prefix='red_list_status')
    trophic_level = pd.get_dummies(data.TrophicLevel, prefix='trophic_level')
    phylo_order = pd.get_dummies(data.Order, prefix='order_')
    data = pd.concat([data, red_list_status, phylo_order, trophic_level], axis=1)
    columns_to_drop = ['Family', 'Genus', 'Order', 'RedListStatus', 'TrophicLevel','population', 'population']
    data = data.drop([x for x in columns_to_drop if x in data.columns], axis=1)
    cat_features = list(red_list_status.columns) + list(phylo_order.columns) +list(trophic_level)
    if include_range_feature:
        cont_features = ['log_range', 'log_body_mass']
        # In case you want to examine the  model with the generation length feature, comment the line above this
        # one and uncomment the line below
        # cont_features = ['log_range', 'log_body_mass','log_gen_length']
    else:
        cont_features = ['log_body_mass']
    label_name = 'log_density'
    return [data, cat_features, cont_features, label_name]



def scale_cont(dataset, cont_features, label_name):
    feature_scaler = StandardScaler()
    label_scaler = StandardScaler()
    scaled_features = feature_scaler.fit_transform(np.array(dataset[cont_features]))
    scaled_features = pd.DataFrame(scaled_features, index=dataset.index, columns=cont_features)
    scaled_labels = label_scaler.fit_transform(np.array(dataset[label_name]).reshape(-1, 1))
    scaled_labels = pd.DataFrame(scaled_labels, index=dataset.index, columns=[label_name])
    return [feature_scaler, label_scaler, scaled_features, scaled_labels]


def svr(labeled_data, cat_features, cont_features, label_name, random_state):
    labeled_data = labeled_data.assign(log_density=labeled_data.log_pop-labeled_data.log_range)
    feature_scaler, label_scaler, scaled_features, scaled_labels = scale_cont(labeled_data, cont_features, label_name)
    scaled_df = pd.concat([scaled_features, labeled_data[cat_features]], axis=1)
    x_train, x_test, y_train, y_test = train_test_split(scaled_df, scaled_labels, test_size=0.1,
                                                        random_state=random_state)
    regressor = SVR(kernel='rbf', C = 1.176, epsilon=1.2e-06, gamma = 0.07)
    regressor.fit(x_train, y_train.values.ravel())
    pred = regressor.predict(x_test).reshape(-1,1)
    predictions_df = pd.DataFrame(label_scaler.inverse_transform(pred),
                                  index=x_test.index, columns=['predictions'])
    test_set = pd.DataFrame(x_test.apply(lambda row: row.name, axis=1))
    result_df = test_set.join(labeled_data).drop([0], axis=1)
    result_df = result_df.join(predictions_df)
    rmse = math.sqrt(mean_squared_error(result_df.predictions, result_df[label_name]))
    return [result_df, rmse]


def update_result_df(result_df):
    result_df['prediction_mean'] = result_df.loc[:, result_df.columns == 'predictions'].mean(numeric_only=True, axis=1)
    result_df = result_df.drop(['predictions'], axis=1)
    return result_df


def svr_predict(data, cat_features, cont_features, label_name, mean_rmse, seed):
    np.random.seed(seed)
    data = data.assign(log_pop_value = data.log_pop_dist.apply(np.random.choice))
    data = data.assign(log_density=data.log_pop_value-data.log_range)
    feature_scaler, label_scaler, scaled_features, scaled_labels = scale_cont(data, cont_features, label_name)
    scaled_df = pd.concat([scaled_features, data[cat_features]], axis=1)

    x_train = scaled_df.loc['labeled']
    y_train = scaled_labels.loc['labeled']
    regressor = SVR(kernel='rbf', C = 1)
    regressor.fit(x_train, y_train.values.ravel())
    pred = regressor.predict(scaled_df.loc['not_labeled']).reshape(-1,1)
    log_predictions = label_scaler.inverse_transform(pred)

    # unbiased estimator of the mean
    if label_name == 'log_density':
        predictions = np.exp(log_predictions + ((round(mean_rmse, 1)**2) / 2) )
        predictions_df = pd.DataFrame(predictions, index=scaled_df.loc['not_labeled'].index, columns=['pred. density (ind/km^2)'])
        predictions_df = data.loc['not_labeled'].join(predictions_df)
        predictions_df = predictions_df.assign(population=predictions_df['pred. density (ind/km^2)'] * predictions_df.range)
    else:
        predictions_df = pd.DataFrame(log_predictions, index=scaled_df.loc['not_labeled'].index,
                                      columns=['pred. log density ratio'])
        predictions_df = data.loc['not_labeled'].join(predictions_df)
    return predictions_df

