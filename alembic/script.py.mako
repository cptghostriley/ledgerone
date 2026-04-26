from alembic import context
from sqlalchemy.schema import SchemaItem

def _render_item(type_, obj, autogen_context):
    if type_ == 'type' and obj.__class__.__name__ == 'VECTOR':
        return "Vector(768)"
    return False
    
def write_hooks(script, prog_args):
    pass
