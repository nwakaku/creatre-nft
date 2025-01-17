import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Upload, message, Select, Switch } from 'antd';
import Unknown from '@/assets/images/icon/unknown.svg';
import './style.less';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PubSub from 'pubsub-js';
import { ShowAuthDrawer } from '@/message';
import { isAuthTokenEffect, getValueDivide8 } from '@/utils/utils';
import { getCreateCollectionByUser, getCreateCollectionSettings } from '@/pages/home/store/actions';
import Toast from '@/components/toast';
import { createNewNFT } from '@/api/createHandler';
import { useHistory } from 'react-router-dom';
import VideoPlayer from '@/components/video-player';
import { getCreatePubCollection } from '@/pages/home/store/actions';
import { Principal } from '@dfinity/principal';
import lauDefault from '@/assets/images/launchpad/lau-default.png';
import ConfirmModal from '@/components/confirm-modal';
import { userHooks } from '@/components/hooks';
import { CollectionType } from '@/constants';
import { MinusCircleOutlined } from '@ant-design/icons';
import BigNumber from 'bignumber.js';

const Jimp = require('jimp').default;

/* eslint-enable no-template-curly-in-string */

const CreateNewNFT = (props) => {
  let mount = true;
  const { prinId } = props;
  const history = useHistory();
  const dispatch = useDispatch();
  const [nftType, setNFTType] = useState(null);
  const [nftPath, setNFTPath] = useState(null);
  const [thumbData, setThumbData] = useState(null);
  const [thumbType, setThumbType] = useState(null);
  const [mutablePath, setMutablePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pixelFixed, setPixelFixed] = useState(false);
  const newNFTForm = React.useRef();
  const layout = {
    labelCol: {
      span: 6,
    },
    wrapperCol: {
      span: 12,
    },
  };

  const validateMessages = {
    required: '${label} is required!',
    number: {
      range: '${label} must be between ${min} and ${max}',
    },
  };
  const defaultConfig = {
    forkRoyaltyRatio: 0,
    maxDescSize: 2000,
    totalSupply: 5000,
    uploadProtocolBaseFee: 10000000n,
    uploadProtocolFeeRatio: 1,
    maxRoyaltyRatio: 30,
    maxAttrNum: 20,
    maxNameSize: 20,
    maxCategorySize: 20,
    marketFeeRatio: 1,
    newItemForkFee: 0,
    mutablePhotoLink: [],
  };
  const [submitEnable, setSubmitEnable] = useState(false);
  const [confrimVisible, setConfirmVisible] = useState(false);
  const { isAuth, authToken, wicpBalance } = userHooks();
  const { userCollections, pubCollections, config, selectType } = useSelector((state) => {
    let selectType = newNFTForm?.current?.getFieldsValue()?.collection;
    return {
      userCollections: state.allcavans.getIn([`createCollection-${authToken}`]) || null,
      pubCollections: state.allcavans.getIn([`pubCollection`]) || null,
      config: selectType ? state.allcavans.getIn([`artCollectionConfig-${selectType}`]) || defaultConfig : defaultConfig,
      selectType,
    };
  }, shallowEqual);

  useEffect(() => {
    if (isAuthTokenEffect(isAuth, authToken))
      dispatch(
        getCreateCollectionByUser(authToken, (value) => {
          mount && setLoading(false);
        }),
      );
    return () => {
      mount = false;
    };
  }, [isAuth, authToken]);

  useEffect(() => {
    dispatch(
      getCreatePubCollection(() => {
        mount && setLoading(false);
      }),
    );
    return () => {
      mount = false;
    };
  }, []);

  useEffect(() => {
    if (prinId && newNFTForm?.current) {
      newNFTForm?.current.setFieldsValue({ collection: prinId });
      dispatch(getCreateCollectionSettings(prinId));
    }
  }, [prinId]);

  const confirmFunc = () => {
    let needBalance = config.uploadProtocolBaseFee;
    if (new BigNumber(wicpBalance).lt(needBalance)) {
      message.error('Insufficient balance');
      return;
    }
    const values = newNFTForm?.current?.getFieldsValue();
    let notice = Toast.loading('In process, please wait', 0);
    let data = {
      key: values.collection,
      success: (res) => {
        message.success('success');
        history.replace('/assets/wallet/createItems');
      },
      fail: (res) => {
        message.error(res);
      },
      error: (res) => {
        message.error(res);
      },
      notice,
    };
    let attrArr = [];
    if (values.attrArr) {
      for (let item of values.attrArr) {
        if (item.traitType && item.name) {
          attrArr.push(item);
        }
      }
    }
    data.param = {
      orignData: values.data ? values.data : [],
      thumbnailData: values.thumb ? values.thumb : thumbData,
      mutableData: values.mutable ? values.mutable : null,
      nftType,
      thumbType,
      desc: values.desc || '',
      name: values.name,
      attrArr,
    };
    data.param.bFork = true;
    data.param.parentToken = [];
    data.param.earnings = values.earnings * 10 || 20;
    data.param.royaltyFeeTo = values.royalty ? Principal.fromText(values.royalty) : Principal.fromText(authToken);
    createNewNFT(data);
  };

  const onFinish = () => {
    if (!isAuth) {
      PubSub.publish(ShowAuthDrawer, {});
      return;
    }
    setConfirmVisible(true);
  };
  const checkImageWH = (file, width, height) => {
    return new Promise(function (resolve, reject) {
      let filereader = new FileReader();
      filereader.onload = (e) => {
        let src = e.target.result;
        const image = new Image();
        image.onload = function () {
          if (this.width >= width || this.height >= height) {
            resolve('limit');
          } else {
            resolve('success');
          }
        };
        image.onerror = reject;
        image.src = src;
      };
      filereader.readAsDataURL(file);
    });
  };
  const beforeUpload = async (file) => {
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      // 添加文件限制
      message.error({ content: 'The file size cannot exceed 10M' });
      return Upload.LIST_IGNORE;
    } else {
      if (file?.type?.startsWith('image/')) {
        let res = await checkImageWH(file, 4000, 4000);
        if (res === 'limit') {
          message.error({ content: 'The image size limited to 4000x4000' });
          return Upload.LIST_IGNORE;
        }
      }
    }
  };

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }

    return e && e.fileList;
  };

  function getBase64(img, callback) {
    const reader = new FileReader();
    reader.addEventListener('load', () => callback(reader.result));
    reader.readAsDataURL(img);
  }

  const resizeSelectImage = (path, thumbWidth, thumbHeight, type, callback) => {
    Jimp.read(path).then(async (image) => {
      let width = image.bitmap.width;
      let height = image.bitmap.height;
      if (width > thumbWidth || height > thumbHeight) {
        let scale = Math.min(thumbWidth / width, thumbHeight / height);
        width = Math.floor(scale * width);
        height = Math.floor(scale * height);
        callback(await image.getBufferAsync(type), await image.resize(width, height).getBufferAsync(type)); // resize
      } else callback(await image.getBufferAsync(type), null);
    });
  };

  const handleSelectImage = async (info) => {
    const { fileList } = info;
    const file = fileList[fileList.length - 1];
    if (file?.originFileObj) {
      if (file.percent < 100) return;
      let path = window.URL.createObjectURL(file.originFileObj);
      if (file.type.startsWith('image/')) {
        setNFTPath(path);
        setNFTType(file.type);
        newNFTForm?.current?.setFieldsValue({ data: null });
        resizeSelectImage(path, 500, 500, file.type, (originalData, thumbData) => {
          if (thumbData) {
            setThumbType(file.type);
            setThumbData(thumbData);
          }
          newNFTForm?.current?.setFieldsValue({ data: originalData });
          newNFTForm?.current?.setFieldsValue({ thumb: null });
        });
      } else {
        setThumbType(null);
        setThumbData(null);
      }
    }
  };

  const handleSelectThumbImage = (info, field) => {
    const { fileList } = info;
    const file = fileList[fileList.length - 1];
    if (file?.originFileObj) {
      getBase64(file?.originFileObj, async (imageUrl) => {
        setThumbData(imageUrl);
        setThumbType(file.type);
        newNFTForm?.current?.setFieldsValue({ thumb: await file.originFileObj.arrayBuffer() });
      });
    }
  };

  const handleMutableImage = async (info) => {
    const { fileList } = info;
    const file = fileList[fileList.length - 1];
    if (file?.originFileObj) {
      if (file.percent < 100) return;
      let path = window.URL.createObjectURL(file.originFileObj);
      setMutablePath(path);
      newNFTForm?.current?.setFieldsValue({ mutable: await file.originFileObj.arrayBuffer() });
    }
  };

  const handleSelectCollection = (value) => {
    if (value === 'create') {
      history.push('/create/collection');
    } else {
      dispatch(getCreateCollectionSettings(value));
    }
  };
  const onHandleChangePixelFixed = (res) => setPixelFixed(res);
  const horizonalLayout = {
    labelCol: {
      span: 3,
    },
    wrapperCol: {
      span: 18,
    },
  };

  const onFieldsChange = () => {
    const fieldsValue = newNFTForm?.current?.getFieldsValue();
    if (fieldsValue) {
      const required = ['data1', 'data2', 'name', 'desc', 'collection'];
      const errArr = Object.keys(fieldsValue).filter((item) => {
        let index = required.indexOf(item);
        if (index !== -1) {
          if (!fieldsValue[item]) {
            return true;
          }
        }
      });
      setSubmitEnable(errArr.length > 0 ? false : true);
    }
  };

  return (
    <Form className="create-nft-wrapper" {...layout} name="nest-messages" onFinish={onFinish} ref={newNFTForm} onFieldsChange={onFieldsChange} validateMessages={validateMessages}>
      <h2>Create New NFT</h2>
      <div className="required-field tip">Required fields</div>
      <div className="required-field title margin-10">Upload file</div>
      <div className="tip margin-10">PNG, GIF, WEBP, MP4 , MP3 or Html. Max 10mb</div>
      <Form.Item className="margin-10" name="data">
        <Form.Item rules={[{ required: true }]} name="data1" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
          <Upload.Dragger accept="image/*, .mp4, .mp3, .html" beforeUpload={beforeUpload} showUploadList={false} onChange={(info) => handleSelectImage(info)}>
            {nftType ? (
              <div className="picture nft">
                {nftType.startsWith('image/') ? (
                  <img alt="" src={nftPath} className="select-image"></img>
                ) : nftType.startsWith('video/') || nftType.startsWith('audio/') ? (
                  <VideoPlayer src={nftPath} controls={true} />
                ) : (
                  <embed src={nftPath} width="100%" height="100%"></embed>
                )}
                <div className="mask-inner" />
              </div>
            ) : (
              <div className="picture nft">
                <div className="mask-bg" />
                <img alt="" src={Unknown} className="default"></img>
              </div>
            )}
          </Upload.Dragger>
        </Form.Item>
      </Form.Item>
      <div className="tip margin-10">Once confirmed, it cannot be modified</div>
      {nftType && !nftType.startsWith('image/') && (
        <div>
          <div className="required-field title margin-10">Preview Image</div>
          <div className="tip margin-10">Because you’ve included multimedia, you’ll need to provide an image (PNG, JPG, or GIF) for the card display of your item.</div>
          <Form.Item className="margin-10" name="thumb">
            <Form.Item rules={[{ required: true }]} name="data2" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
              <Upload.Dragger accept="image/*" beforeUpload={beforeUpload} showUploadList={false} onChange={(info) => handleSelectThumbImage(info)}>
                {thumbData ? (
                  <div className="picture thumb">
                    <img alt="" src={thumbData} className="select-image"></img>
                    <div className="mask-inner" />
                  </div>
                ) : (
                  <div className="picture thumb">
                    <div className="mask-bg" />
                    <img alt="" src={Unknown} className="default"></img>
                  </div>
                )}
              </Upload.Dragger>
            </Form.Item>
          </Form.Item>
          <div className="tip margin-10">Once confirmed, it cannot be modified</div>
        </div>
      )}
      <div className="required-field title margin-40">NFT name</div>
      <Form.Item className="margin-10" name="name" rules={[{ required: true }]}>
        <Input showCount maxLength={parseInt(config.maxNameSize || 20)} />
      </Form.Item>
      <div className="required-field title margin-40">Description</div>
      <div className="tip margin-10">Please fill in carefully,Once confirmed,Can't be modified.</div>
      <Form.Item className="margin-10" name="desc" rules={[{ required: true }]}>
        <Input.TextArea showCount maxLength={parseInt(config.maxDescSize || 2000)} />
      </Form.Item>
      <div className="required-field title margin-40">Collection</div>
      <Form.Item className="margin-10" name="collection" rules={[{ required: true }]}>
        <Select
          dropdownClassName="create-dropdown"
          placeholder="This is the collection where your item will appear"
          loading={loading}
          defaultValue={prinId}
          disabled={prinId}
          onSelect={handleSelectCollection}
          suffixIcon={<img alt="" src={lauDefault} />}
        >
          {pubCollections &&
            pubCollections.map((item) => {
              return (
                <Select.Option key={item.title} value={item.key}>
                  {item.title}
                  <div
                    style={{
                      fontSize: '14px',
                      fontFamily: 'Poppins-Medium, Poppins',
                      fontWeight: 500,
                      color: '#FFFFFF',
                      lineHeight: '23px',
                      padding: '2px 16px',
                      background: '#52C41A',
                      borderRadius: '6px',
                      marginLeft: '50px',
                    }}
                  >
                    public
                  </div>
                </Select.Option>
              );
            })}
          {userCollections &&
            userCollections.map((item) => {
              return (
                <Select.Option key={item.title} value={item.key}>
                  {item.title}
                  <div
                    style={{
                      fontSize: '14px',
                      fontFamily: 'Poppins-Medium, Poppins',
                      fontWeight: 500,
                      color: '#FFFFFF',
                      lineHeight: '23px',
                      padding: '2px 16px',
                      background: '#4338CA',
                      borderRadius: '6px',
                      marginLeft: '50px',
                    }}
                  >
                    owned
                  </div>
                </Select.Option>
              );
            })}
          <Select.Option key={'create'} value={'create'}>
            {'Create new collection'}
            <div
              style={{
                fontSize: '14px',
                fontFamily: 'Poppins-Medium, Poppins',
                fontWeight: 500,
                color: '#FFFFFF',
                lineHeight: '23px',
                padding: '2px 16px',
                background: '#E02020',
                borderRadius: '6px',
                marginLeft: '50px',
              }}
            >
              charge
            </div>
          </Select.Option>
        </Select>
      </Form.Item>
      {selectType?.split(':')[2] == CollectionType.CollectionPrivite && (
        <div>
          <div className="title margin-40">Add Properties:</div>
          <Form.List className="margin-10" name="attrArr">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ width: '100%', display: 'flex', marginTop: 10, alignItems: 'center' }}>
                    <Form.Item {...horizonalLayout} {...restField} name={[name, 'traitType']} style={{ width: '35%', alignItems: 'center' }} label="Type" labelAlign="left">
                      <Input maxLength={20} />
                    </Form.Item>
                    <Form.Item {...horizonalLayout} {...restField} name={[name, 'name']} style={{ width: '35%', alignItems: 'center' }} label="Name" labelAlign="left">
                      <Input maxLength={20} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </div>
                ))}
                <Form.Item className="margin-40">
                  <Button
                    className="add-button"
                    onClick={() => {
                      if (fields.length >= 10) return;
                      add();
                    }}
                    block
                  >
                    Add Properties +
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </div>
      )}

      <div
        className="
          title margin-40"
      >
        Creator Earnings
      </div>
      <div className="tip margin-10">
        Collect a fee when a user re-sells an item you originally created. This is deducted from the final sale price and paid monthly to a payout address of your choosing
      </div>
      <Form.Item className="margin-10" name="earnings">
        <InputNumber
          min={0}
          max={parseInt(config.maxRoyaltyRatio) / 10}
          controls={false}
          precision={1}
          placeholder="Percentage fee e.g.2"
          defaultValue="2"
          addonAfter={`max ${parseInt(config.maxRoyaltyRatio) / 10}`}
        />
      </Form.Item>

      <div className="title margin-40">Royalty Address</div>
      <div className="tip margin-10">The royalties will be stored in the Principal ID you created on Dcreate</div>
      <Form.Item className="margin-10" name="royalty">
        <Input placeholder="Entre your Principal ID" defaultValue={authToken} />
      </Form.Item>

      {/* {config.mutablePhotoLink.length === 0 && (
        <div>
          <div className="title margin-40">Partially modified</div>
          <div className="tip margin-10">After opening, it can be set to modify the pixel content </div>
          <Switch className="margin-10" checked={pixelFixed} onChange={onHandleChangePixelFixed} />
          {pixelFixed && (
            <div>
              <div className="tip margin-10">Png</div>
              <Form.Item className="margin-10" name="mutable">
                <Form.Item name="data1" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
                  <Upload.Dragger accept="image/png" beforeUpload={beforeUpload} showUploadList={false} onChange={(info) => handleMutableImage(info)}>
                    {mutablePath ? (
                      <div className="picture nft">
                        <img alt="" src={mutablePath} className="select-image"></img>
                        <div className="mask-inner" />
                      </div>
                    ) : (
                      <div className="picture nft">
                        <div className="mask-bg" />
                        <img alt="" src={Unknown} className="default"></img>
                      </div>
                    )}
                  </Upload.Dragger>
                </Form.Item>
              </Form.Item>

              <div className="tip margin-10">Note: You need to upload the modifiable part in png format, and make sure it is the same size as the last uploaded image</div>
            </div>
          )}
        </div>
      )} */}

      <div className="divider margin-40"></div>
      <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 0 }} className="margin-40">
        <Button type="black" className="btn-normal" htmlType="submit" disabled={!submitEnable}>
          {isAuth ? 'Create NFT' : 'Connect wallet'}
        </Button>
      </Form.Item>
      <div className="required-field warning margin-10">{`Please note that you need to pay ${getValueDivide8(config.uploadProtocolBaseFee)} WICP to create an artwork once`}</div>
      <ConfirmModal
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
        }}
        title={'Create NFT'}
        width={454}
        wrapClassName={'wallet-modal'}
        onModalClose={() => {
          setConfirmVisible(false);
        }}
        btnClass={['dc-cancel-btn', 'dc-confirm-btn']}
        onModalConfirm={confirmFunc}
        modalVisible={confrimVisible}
      >
        <>
          <div className="tips">{`Are you sure to pay ${getValueDivide8(config.uploadProtocolBaseFee)} WICP to create an artwork? `}</div>
        </>
      </ConfirmModal>
    </Form>
  );
};

export default CreateNewNFT;
