"""SQLAlchemyモデル定義"""
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import json

from extensions import db

# PostGIS対応の判定
try:
    from geoalchemy2 import Geometry
    _has_postgis = True
except ImportError:
    _has_postgis = False


class Store(db.Model):
    """店舗情報テーブル"""
    __tablename__ = 'stores'
    
    store_id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(500), nullable=False, index=True)
    phone = Column(String(50), index=True)
    website = Column(Text)
    address = Column(Text, index=True)
    category = Column(String(200), index=True)
    rating = Column(Float)
    city = Column(String(100), index=True)
    place_id = Column(String(255), index=True)
    url = Column(Text)
    is_franchise = Column(Boolean, default=False, index=True)
    
    # 地理空間情報
    if _has_postgis:
        location = Column(Geometry('POINT', srid=4326), index=True)
    else:
        location = Column(Text)
    
    opening_date = Column(String(50))
    closed_day = Column(String(100))
    transport = Column(Text)
    business_hours = Column(Text)
    official_account = Column(Text)
    data_source = Column(String(50), index=True)
    collected_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    delivery_services = relationship('DeliveryService', back_populates='store', cascade='all, delete-orphan')
    store_statuses = relationship('StoreStatus', back_populates='store', cascade='all, delete-orphan')
    
    __table_args__ = (
        Index('idx_store_data_source', 'data_source'),
        Index('idx_store_city', 'city'),
        Index('idx_store_category', 'category'),
    )
    
    def to_dict(self):
        """辞書形式に変換"""
        return {
            'store_id': self.store_id,
            'name': self.name,
            'phone': self.phone,
            'website': self.website,
            'address': self.address,
            'category': self.category,
            'rating': self.rating,
            'city': self.city,
            'place_id': self.place_id,
            'url': self.url,
            'is_franchise': self.is_franchise,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'opening_date': self.opening_date,
            'closed_day': self.closed_day,
            'transport': self.transport,
            'business_hours': self.business_hours,
            'official_account': self.official_account,
            'data_source': self.data_source,
            'collected_at': self.collected_at.isoformat() if self.collected_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'delivery_services': [ds.service_name for ds in self.delivery_services if ds.is_active],
        }
    
    @property
    def location_lat(self):
        """緯度を取得"""
        if not self.location:
            return None
        try:
            return self.location.y
        except (AttributeError, TypeError):
            try:
                loc_data = json.loads(self.location)
                return loc_data.get('lat')
            except (json.JSONDecodeError, TypeError):
                return None
    
    @property
    def location_lng(self):
        """経度を取得"""
        if not self.location:
            return None
        try:
            return self.location.x
        except (AttributeError, TypeError):
            try:
                loc_data = json.loads(self.location)
                return loc_data.get('lng')
            except (json.JSONDecodeError, TypeError):
                return None


class DeliveryService(db.Model):
    """デリバリーサービス情報テーブル"""
    __tablename__ = 'delivery_services'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(String(255), ForeignKey('stores.store_id', ondelete='CASCADE'), nullable=False, index=True)
    service_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    store = relationship('Store', back_populates='delivery_services')
    
    __table_args__ = (
        db.UniqueConstraint('store_id', 'service_name', name='uq_store_service'),
    )


class User(db.Model):
    """ユーザー管理テーブル"""
    __tablename__ = 'users'
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_code = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(200), nullable=False)
    email = Column(String(255), index=True)
    phone = Column(String(50))
    organization = Column(String(200))
    user_type = Column(String(20), nullable=False, default='partner', index=True)
    is_agency = Column(Boolean, default=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime)
    created_by = Column(String(255))
    notes = Column(Text)
    
    # store_statusesリレーションは外部キーなし（rep_idは文字列として保存されるため）


class StoreStatus(db.Model):
    """店舗ステータス管理テーブル"""
    __tablename__ = 'store_statuses'
    
    # rep_idはString型で保存（UUIDを文字列として扱う）
    rep_id = Column(String(255), primary_key=True)
    store_id = Column(String(255), ForeignKey('stores.store_id', ondelete='CASCADE'), primary_key=True, index=True)
    status = Column(String(50), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    store = relationship('Store', back_populates='store_statuses')
    # Userとのリレーションは外部キーなしで定義（rep_idは文字列として保存）
