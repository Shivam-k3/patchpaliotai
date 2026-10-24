def test_divide_by_zero():
    from mathlib import divide
    import pytest
    with pytest.raises(ValueError):
        divide(1, 0)
