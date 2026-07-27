from pathlib import Path

path = Path('/tmp/apply.py')
text = path.read_text()
old_helper = '''def replace(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f'missing replacement anchor in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))
'''
new_helper = '''def replace(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        for width in range(1, 17):
            prefix = ' ' * width
            indented_old = '\\n'.join(prefix + line if line else line for line in old.split('\\n'))
            if indented_old in text:
                old = indented_old
                new = '\\n'.join(prefix + line if line else line for line in new.split('\\n'))
                break
    if old not in text:
        raise SystemExit(f'missing replacement anchor in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))
'''
if old_helper not in text:
    raise SystemExit('replace helper anchor missing')
text = text.replace(old_helper, new_helper, 1)

old_paragraph = '进行中合同卡先展示当前批次履约状态，再展示长期合同条款。供应方托管商品、采购方托管货款、下次交付、宽限期和异常文字集中在“当前批次”区域；每批商品、单位价格、每批货款和交付周期集中在“合同条款”区域。手动准备或补款是当前批次主要操作，自动准备和自动补款必须使用 `ToggleField`／`SwitchControl`，申请批次后结束与立即违约终止单独放在底部管理区。'
current_paragraph = '进行中合同卡先展示当前批次履约状态，再展示长期合同条款。供应方托管商品、采购方托管货款、下次交付、宽限期和异常文字集中在“当前批次”区域；每批商品、单位价格、每批货款和交付周期集中在“合同条款”区域。商品标题复用 `ProductIconLabel`，完成批次保留进度轨道。手动准备或补款是当前批次主要操作，自动准备和自动补款必须使用 `ToggleField`／`SwitchControl`，申请批次后结束与立即违约终止单独放在底部管理区。'
new_paragraph = '进行中合同卡先展示当前批次履约状态，再展示长期合同条款。供应方托管商品、采购方托管货款、下次交付、宽限期和异常文字集中在“当前批次”区域；每批商品、单位价格、每批货款和交付周期集中在“合同条款”区域。手动准备或补款是当前批次主要操作，自动准备和自动补款必须使用 `ToggleField`／`SwitchControl`。合同剩余三批以内且不在宽限期、未申请结束时显示续签区；商品与合作方固定继承，可调整数量、价格、周期、总批次和首次交付延迟。待确认续签进入“待处理”和导航角标；双方确认后显示锁定状态，申请批次后结束与立即违约终止仍单独放在底部管理区。'
merged_paragraph = '进行中合同卡先展示当前批次履约状态，再展示长期合同条款。供应方托管商品、采购方托管货款、下次交付、宽限期和异常文字集中在“当前批次”区域；每批商品、单位价格、每批货款和交付周期集中在“合同条款”区域。商品标题复用 `ProductIconLabel`，完成批次保留进度轨道。手动准备或补款是当前批次主要操作，自动准备和自动补款必须使用 `ToggleField`／`SwitchControl`。合同剩余三批以内且不在宽限期、未申请结束时显示续签区；商品与合作方固定继承，可调整数量、价格、周期、总批次和首次交付延迟。待确认续签进入“待处理”和导航角标；双方确认后显示锁定状态，申请批次后结束与立即违约终止仍单独放在底部管理区。'
if old_paragraph not in text or new_paragraph not in text:
    raise SystemExit('contract design paragraph patch anchor missing')
text = text.replace(old_paragraph, current_paragraph, 1)
text = text.replace(new_paragraph, merged_paragraph, 1)
path.write_text(text)
