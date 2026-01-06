"""Celeryタスク"""
from celery import Celery


def make_celery(app):
    """Celeryアプリケーションを作成"""
    celery = Celery(
        app.import_name,
        broker=app.config['CELERY_BROKER_URL'],
        backend=app.config['CELERY_RESULT_BACKEND']
    )
    celery.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='Asia/Tokyo',
        enable_utc=True,
    )
    
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    return celery


def register_tasks(celery_app):
    """スクレイピングタスクを登録"""
    pass


def register_enrichment_tasks(celery_app):
    """データ補完タスクを登録"""
    pass
