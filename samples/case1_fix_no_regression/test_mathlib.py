def test_divide_ok():
    from mathlib import divide
    assert divide(6, 2) == 3
def test_divide_by_zero():
    from mathlib import divide
    import pytest
    with pytest.raises(ValueError):
        divide(1, 0)
