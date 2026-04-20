from fastapi import APIRouter

from app.schemas import ContractStatus, EnergyType, EnumValuesResponse, GridZone

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/enums", response_model=EnumValuesResponse)
def get_enums() -> EnumValuesResponse:
    return EnumValuesResponse(
        energy_types=[e.value for e in EnergyType],
        statuses=[s.value for s in ContractStatus],
        grid_zones=[z.value for z in GridZone],
    )
