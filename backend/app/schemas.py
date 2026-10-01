"""API input models; field lengths follow the existing SQL Server definitions."""

from pydantic import BaseModel, Field


class Login(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class GroupSelection(BaseModel):
    group_id: str = Field(min_length=1, max_length=16)


class MaterialValues(BaseModel):
    title: str = Field(default="", max_length=128)
    category_code: str = Field(default="", max_length=2)
    genre_code: str = Field(default="", max_length=2)
    material_content: str = Field(default="", max_length=1000)
    handover_note: str = Field(default="", max_length=500)


class MaterialEdit(BaseModel):
    values: MaterialValues
    expected: MaterialValues


class NameEdit(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    expected: str = Field(max_length=128)


class NewBlock(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class DeleteBlock(BaseModel):
    expected: str = Field(max_length=128)
